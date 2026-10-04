import pytest


@pytest.mark.asyncio
async def test_root_endpoint(client):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Hospital Bill Auditor (India)"
    assert data["demo_mode"] is True


@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["demo_mode"] is True
    assert "database" in data
    assert "providers" in data
    assert data["providers"]["ocr"]["provider_name"] == "mock_ocr"
    assert data["providers"]["llm"]["provider_name"] == "mock_llm"
    assert data["providers"]["storage"]["provider_name"] == "local_storage"


@pytest.mark.asyncio
async def test_health_ready_probe(client):
    response = await client.get("/api/v1/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["ready"] is True
