"""Minimal in-process pub/sub so the UI can be told, in real time, when a
background job (e.g. sending an invite email) finishes — without polling.
Single-process only; fine for this app's current deployment shape."""

import asyncio
from collections import defaultdict

_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)


def subscribe(organization_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers[organization_id].add(queue)
    return queue


def unsubscribe(organization_id: str, queue: asyncio.Queue) -> None:
    _subscribers[organization_id].discard(queue)


def publish(organization_id: str, event: dict) -> None:
    for queue in _subscribers[organization_id]:
        queue.put_nowait(event)
