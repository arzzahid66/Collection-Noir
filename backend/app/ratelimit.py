"""A small fixed-window rate limiter for the public enquiry route.

`POST /api/enquiries` is unauthenticated, unthrottled and writes a row. That is
the whole attack surface of the site, and the cost of leaving it open is a
database full of junk and a mail provider allowance spent on it.

Deliberately in-process and dependency free. Redis would be the right answer
for several API hosts sharing one counter; there is one host, and adding a
service to run alongside it would be a larger operational change than the
problem warrants. The trade-off is stated rather than hidden: with more than
one worker process each keeps its own counter, so the effective limit is the
configured one multiplied by the worker count. At the numbers used here that
is still a low ceiling.

Memory is bounded by expiring buckets on read, so a burst from many addresses
cannot grow the map indefinitely.
"""

from __future__ import annotations

import threading
import time
from collections import deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self._limit = limit
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, now: float) -> None:
        """Drop buckets with nothing left in the window. Caller holds the lock."""
        stale = [key for key, times in self._hits.items() if not times or now - times[-1] > self._window]
        for key in stale:
            del self._hits[key]

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            # Cheap enough to sweep on every call at this volume, and it means
            # there is no background task to own or shut down.
            self._prune(now)
            times = self._hits.setdefault(key, deque())
            while times and now - times[0] > self._window:
                times.popleft()
            if len(times) >= self._limit:
                return False
            times.append(now)
            return True

    def reset(self) -> None:
        """Clear every bucket. For tests, which must not leak state between cases."""
        with self._lock:
            self._hits.clear()


def client_key(request) -> str:  # noqa: ANN001 - fastapi Request, avoids the import cycle
    """The address to count against.

    Behind nginx the socket peer is always 127.0.0.1, so the forwarded header
    is what identifies the caller. Its first entry is the client; the rest are
    proxies. This trusts the header, which is only safe because the service is
    reached through a proxy that sets it. Exposing uvicorn directly to the
    internet would let a caller spoof it and would need this reconsidered.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Five enquiries an hour from one address. A real client sends one, or two if
# they enquire about a second piece; a script sends far more.
enquiry_limiter = RateLimiter(limit=5, window_seconds=3600)
