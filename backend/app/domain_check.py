"""Real domain-ownership verification via a DNS TXT record — the same
pattern Google Workspace, Slack, etc. use: publish a token under
_agentguard-verify.<domain>, we look it up over real DNS."""

import re

import dns.exception
import dns.resolver

DOMAIN_PATTERN = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$", re.IGNORECASE)


def is_valid_domain(domain: str) -> bool:
    return bool(DOMAIN_PATTERN.match(domain.strip()))


def verification_record_name(domain: str) -> str:
    return f"_agentguard-verify.{domain}"


def check_domain_txt_record(domain: str, expected_token: str) -> bool:
    record_name = verification_record_name(domain)
    try:
        answers = dns.resolver.resolve(record_name, "TXT", lifetime=8)
    except (dns.exception.DNSException, OSError):
        return False
    for rdata in answers:
        value = b"".join(rdata.strings).decode("utf-8", errors="ignore").strip()  # type: ignore[attr-defined]
        if value == expected_token:
            return True
    return False
