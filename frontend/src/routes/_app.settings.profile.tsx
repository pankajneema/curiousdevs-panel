import { useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError, getStoredSession, updateAvatar, updateProfile } from "@/lib/api";

export const Route = createFileRoute("/_app/settings/profile")({
  component: PersonalInfoPage,
});

const languages = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
];

const timezones = Intl.supportedValuesOf("timeZone");
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PersonalInfoPage() {
  const session = getStoredSession()!;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(session.user.avatarUrl);
  const [name, setName] = useState(session.user.name);
  const [username, setUsername] = useState(session.user.username);
  const [phone, setPhone] = useState(session.user.phone ?? "");
  const [jobTitle, setJobTitle] = useState(session.user.jobTitle ?? "");
  const [department, setDepartment] = useState(session.user.department ?? "");
  const [bio, setBio] = useState(session.user.bio ?? "");
  const [timezone, setTimezone] = useState(session.user.timezone);
  const [language, setLanguage] = useState(session.user.language);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handlePhotoPick(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      await updateAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleRemovePhoto() {
    setAvatarUrl(null);
    await updateAvatar(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await updateProfile({ name, username, phone, jobTitle, department, bio, timezone, language });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-[13.5px] text-slate">Your name, photo and contact details, visible to your team.</p>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-16 object-cover" />
            ) : (
              <span className="flex size-16 items-center justify-center bg-ink font-mono text-[20px] font-semibold text-paper">
                {initialsOf(name)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="size-[14px]" /> Upload photo
              </Button>
              {avatarUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto}>
                  <X className="size-[14px]" /> Remove
                </Button>
              )}
            </div>
            <p className="text-[11.5px] text-slate">JPG or PNG, up to 2MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoPick(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {error && (
            <p role="alert" className="border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="border border-verdict-allow/30 bg-verdict-allow/10 px-3 py-2 text-[13px] text-ink">
              Profile updated.
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="name">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Username" htmlFor="username">
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </Field>
          </div>

          <Field label="Email" htmlFor="email" hint="Contact support to change your email.">
            <Input id="email" value={session.user.email} disabled />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                placeholder="Not set"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="Job title" htmlFor="jobTitle">
              <Input
                id="jobTitle"
                placeholder="Not set"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Department" htmlFor="department">
            <Input
              id="department"
              placeholder="Not set"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </Field>

          <Field label="Bio" htmlFor="bio">
            <textarea
              id="bio"
              rows={3}
              placeholder="A short description others on your team will see."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full resize-none border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Timezone" htmlFor="timezone" hint="Drives every timestamp shown in the console.">
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Language" htmlFor="language">
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
