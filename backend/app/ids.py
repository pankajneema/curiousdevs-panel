import uuid


def new_id(prefix: str) -> str:
    """Matches the id shape the frontend already expects, e.g. usr_8f2a1c9d0b3e."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
