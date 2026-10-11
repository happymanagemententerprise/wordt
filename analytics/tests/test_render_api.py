import pytest

from wordt_analytics.render_api import PAGE_LIMIT, RenderClient, RenderError


class FakeResponse:
    def __init__(self, status=200, payload=None, text=""):
        self.status_code = status
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json body")
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def get(self, url, headers=None, params=None, timeout=None):
        self.calls.append({"url": url, "headers": headers, "params": params, "timeout": timeout})
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def make_client(session, **kwargs):
    return RenderClient(
        "key",
        "wrkspc_1",
        ["srv_1"],
        session=session,
        sleep=lambda _: None,
        **kwargs,
    )


def test_requires_a_resource_id():
    with pytest.raises(ValueError):
        RenderClient("key", "owner", [])


def test_single_page_and_forward_params():
    session = FakeSession([FakeResponse(200, {"hasMore": False, "logs": [{"id": "a", "message": "{}"}]})])
    client = RenderClient("secret", "wrkspc_1", ["srv_1"], session=session, sleep=lambda _: None)

    logs = client.fetch_logs("2026-10-11T09:00:00Z", "2026-10-11T10:00:00Z")

    assert [log["id"] for log in logs] == ["a"]
    params = session.calls[0]["params"]
    assert params["ownerId"] == "wrkspc_1"
    assert params["resource"] == ["srv_1"]
    assert params["direction"] == "forward"
    assert params["limit"] == PAGE_LIMIT
    assert params["startTime"] == "2026-10-11T09:00:00Z"
    assert session.calls[0]["headers"]["Authorization"] == "Bearer secret"


def test_follows_pagination_and_dedupes_by_id():
    session = FakeSession(
        [
            FakeResponse(200, {"hasMore": True, "nextStartTime": "2026-10-11T09:30:00Z", "logs": [{"id": "a"}, {"id": "b"}]}),
            FakeResponse(200, {"hasMore": False, "logs": [{"id": "b"}, {"id": "c"}]}),
        ]
    )
    client = RenderClient("k", "o", ["srv_1"], session=session, sleep=lambda _: None)
    logs = client.fetch_logs("2026-10-11T09:00:00Z", "2026-10-11T10:00:00Z")
    assert [log["id"] for log in logs] == ["a", "b", "c"]
    assert session.calls[1]["params"]["startTime"] == "2026-10-11T09:30:00Z"


def test_retries_rate_limits_then_succeeds():
    sleeps = []
    session = FakeSession(
        [
            FakeResponse(429, {"message": "slow down"}),
            FakeResponse(200, {"hasMore": False, "logs": [{"id": "a"}]}),
        ]
    )
    client = RenderClient("k", "o", ["srv_1"], session=session, sleep=sleeps.append)
    logs = client.fetch_logs("2026-10-11T09:00:00Z", "2026-10-11T10:00:00Z")
    assert [log["id"] for log in logs] == ["a"]
    assert sleeps == [1]


def test_raises_on_client_error():
    session = FakeSession([FakeResponse(403, {"message": "forbidden"}, text='{"message":"forbidden"}')])
    client = RenderClient("k", "o", ["srv_1"], session=session, sleep=lambda _: None)
    with pytest.raises(RenderError):
        client.fetch_logs("2026-10-11T09:00:00Z", "2026-10-11T10:00:00Z")


def test_retries_exhausted_raises():
    session = FakeSession([FakeResponse(503, text="down"), FakeResponse(503, text="down")])
    client = RenderClient("k", "o", ["srv_1"], session=session, retries=2, sleep=lambda _: None)
    with pytest.raises(RenderError):
        client.fetch_logs("2026-10-11T09:00:00Z", "2026-10-11T10:00:00Z")


def test_requires_a_resource_id_param():
    with pytest.raises(ValueError):
        RenderClient("k", "o", [])
