import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileJson, Pencil, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  createMcpServer,
  deleteMcpServer,
  importMcpServers,
  listMcpServers,
  reverifyMcpServer,
  subscribeToOrgEvents,
  updateMcpServer,
  type McpServerInput,
} from "@/lib/api";
import { mcpStatusClass, mcpStatusLabel } from "@/lib/mcpServerDisplay";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { McpServer, McpTransport } from "@/lib/types";

export const Route = createFileRoute("/_app/mcp-servers")({
  component: McpServersPage,
});

function emptyServerValues(): McpServerInput {
  return { name: "", transport: "http", endpoint: "", command: "", args: [], description: "" };
}

function serverToValues(server: McpServer): McpServerInput {
  return {
    name: server.name,
    transport: server.transport,
    endpoint: server.endpoint ?? "",
    command: server.command ?? "",
    args: server.args,
    description: server.description,
  };
}

function McpServerFormModal({
  title,
  initialValues,
  onSubmit,
  onClose,
}: {
  title: string;
  initialValues: McpServerInput;
  onSubmit: (values: McpServerInput) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<McpServerInput>(initialValues);
  const [argsText, setArgsText] = useState(initialValues.args.join(" "));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setTransport(transport: McpTransport) {
    setValues((v) => ({ ...v, transport }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ ...values, args: argsText.trim().length > 0 ? argsText.trim().split(/\s+/) : [] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="mcp-server-form" size="sm" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="mcp-server-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
            {error}
          </p>
        )}
        <Field label="Server name" htmlFor="mcp-name">
          <Input
            id="mcp-name"
            placeholder="internal-tools-server"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </Field>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">How it runs</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTransport("http")}
              className={[
                "border px-3 py-2 text-left",
                values.transport === "http" ? "border-signal bg-signal/10" : "border-rule hover:bg-surface-2",
              ].join(" ")}
            >
              <p className="text-[12.5px] font-semibold text-ink">Remote (URL)</p>
              <p className="mt-0.5 text-[11px] text-slate">Streamable HTTP or SSE — reachability gets checked.</p>
            </button>
            <button
              type="button"
              onClick={() => setTransport("stdio")}
              className={[
                "border px-3 py-2 text-left",
                values.transport === "stdio" ? "border-signal bg-signal/10" : "border-rule hover:bg-surface-2",
              ].join(" ")}
            >
              <p className="text-[12.5px] font-semibold text-ink">Local (command)</p>
              <p className="mt-0.5 text-[11px] text-slate">Runs on the agent's own host — recorded, not dialed.</p>
            </button>
          </div>
        </div>

        {values.transport === "http" ? (
          <Field label="Endpoint" htmlFor="mcp-endpoint" hint="The MCP server's Streamable HTTP URL.">
            <Input
              id="mcp-endpoint"
              placeholder="https://tools.internal.example.com/mcp"
              value={values.endpoint ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, endpoint: e.target.value }))}
              required
            />
          </Field>
        ) : (
          <>
            <Field label="Command" htmlFor="mcp-command" hint="What launches the server, e.g. npx or a binary path.">
              <Input
                id="mcp-command"
                placeholder="npx"
                value={values.command ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, command: e.target.value }))}
                required
              />
            </Field>
            <Field label="Arguments" htmlFor="mcp-args" hint="Space-separated, in order.">
              <Input
                id="mcp-args"
                placeholder="-y @modelcontextprotocol/server-filesystem /path"
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Description" htmlFor="mcp-description" hint="What this server exposes to agents that connect to it.">
          <textarea
            id="mcp-description"
            rows={3}
            placeholder="Internal ticketing and order-lookup tools."
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            className="w-full resize-none border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          />
        </Field>
      </form>
    </Modal>
  );
}

function ImportServersModal({
  onImported,
  onClose,
}: {
  onImported: (servers: McpServer[]) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await importMcpServers(config);
      onImported(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Import from JSON"
      subtitle="Paste an mcpServers config — the same shape Claude Desktop, Cursor, VS Code, and Windsurf use."
      onClose={onClose}
      maxWidthClass="max-w-lg"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="mcp-import-form" size="sm" disabled={submitting}>
            {submitting ? "Importing…" : "Import"}
          </Button>
        </>
      }
    >
      <form id="mcp-import-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
            {error}
          </p>
        )}
        <textarea
          rows={10}
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          placeholder={'{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]\n    },\n    "remote-tools": {\n      "url": "https://tools.example.com/mcp"\n    }\n  }\n}'}
          className="w-full resize-none border border-rule bg-surface-2 px-3.5 py-2.5 font-machine text-[12px] leading-relaxed text-ink placeholder:text-slate/60 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          required
        />
      </form>
    </Modal>
  );
}

function McpServersPage() {
  const { preferences } = usePreferences();
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reverifyingId, setReverifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setServers(await listMcpServers());
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    return subscribeToOrgEvents((event) => {
      if (event.type === "mcp_server.status") refresh();
    });
  }, []);

  const editingServer = servers?.find((s) => s.id === editingId) ?? null;

  async function handleDelete(id: string) {
    try {
      await deleteMcpServer(id);
      setServers((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this server. Try again.");
    }
  }

  async function handleReverify(id: string) {
    setReverifyingId(id);
    try {
      const updated = await reverifyMcpServer(id);
      setServers((prev) => (prev ? prev.map((s) => (s.id === id ? updated : s)) : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't re-check this server. Try again.");
    } finally {
      setReverifyingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">MCP servers</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-slate">
            Mostly self-populated — a connected agent reports its own MCP config on check-in, so most servers
            show up here without anyone adding them. Remote servers get a real MCP{" "}
            <code className="font-machine text-[12px]">initialize</code> handshake — reachability is checked, not
            assumed. Local (stdio) servers run on the agent's own host, so they're recorded, not dialed. Manual
            registration and JSON import are still here for servers not tied to a connected agent yet.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
            <FileJson className="size-[14px]" /> Import JSON
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-[14px]" /> Register server
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}

      <Card className="mt-6 p-0">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Server</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Status</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Used by</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Last checked</th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers === null && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-[13px] text-slate">
                  Loading servers…
                </td>
              </tr>
            )}
            {servers !== null && servers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <span className="flex flex-col items-center gap-2">
                    <Server className="size-[18px] text-slate" />
                    <span className="text-[13px] text-slate">No MCP servers registered yet.</span>
                  </span>
                </td>
              </tr>
            )}
            {servers !== null &&
              servers.map((server) => (
                <tr key={server.id} className="border-b border-rule last:border-0 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <p className="text-[13.5px] font-semibold text-ink">{server.name}</p>
                    <p
                      className="mt-0.5 max-w-md truncate font-machine text-[11.5px] text-slate"
                      title={server.transport === "http" ? (server.endpoint ?? "") : [server.command, ...server.args].join(" ")}
                    >
                      {server.transport === "http" ? server.endpoint : [server.command, ...server.args].join(" ")}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${mcpStatusClass[server.status]}`}
                      title={server.statusDetail ?? undefined}
                    >
                      {mcpStatusLabel[server.status]}
                    </span>
                    {server.statusDetail && (
                      <p className="mt-1 max-w-xs truncate text-[11px] text-slate" title={server.statusDetail}>
                        {server.statusDetail}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-machine text-[12.5px] whitespace-nowrap text-ink tabular-nums">
                    {server.usedByAgentCount}
                  </td>
                  <td className="px-3 py-3 text-[12.5px] whitespace-nowrap text-slate">
                    {server.checkedAt ? formatDate(server.checkedAt, preferences) : "Never"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {server.transport === "http" && (
                        <button
                          type="button"
                          onClick={() => handleReverify(server.id)}
                          disabled={reverifyingId === server.id}
                          className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:text-ink disabled:opacity-60"
                        >
                          <RefreshCw className={`size-[12px] ${reverifyingId === server.id ? "animate-spin" : ""}`} />
                          Re-check
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingId(server.id)}
                        className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:text-ink"
                      >
                        <Pencil className="size-[12px]" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(server.id)}
                        className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
                      >
                        <Trash2 className="size-[12px]" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      {creating && (
        <McpServerFormModal
          title="Register MCP server"
          initialValues={emptyServerValues()}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const created = await createMcpServer(values);
            setServers((prev) => (prev ? [...prev, created] : [created]));
            setCreating(false);
          }}
        />
      )}

      {editingServer && (
        <McpServerFormModal
          title={`Edit ${editingServer.name}`}
          initialValues={serverToValues(editingServer)}
          onClose={() => setEditingId(null)}
          onSubmit={async (values) => {
            const updated = await updateMcpServer(editingServer.id, values);
            setServers((prev) => (prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : prev));
            setEditingId(null);
          }}
        />
      )}

      {importing && (
        <ImportServersModal
          onClose={() => setImporting(false)}
          onImported={(created) => {
            setServers((prev) => (prev ? [...prev, ...created] : created));
            setImporting(false);
          }}
        />
      )}
    </div>
  );
}
