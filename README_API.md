# LATAMATTERS External API - Quick Start Guide

## Authentication

All requests require an API Key in the Authorization header:

```bash
Authorization: Bearer YOUR_API_KEY
```

## Base URL

- **Production**: `https://api.latamatters.com`
- **Development**: `http://localhost:9001`

## Endpoints

### 1. Get Data (JSON)

```http
GET /api/v1/data?country={code}&variable={name}
```

**Parameters:**
- `country` (optional): ISO 3166-1 alpha-2 code (e.g., `AR`, `BO`)
- `variable` (optional): Variable name (e.g., `Inflacion`)

**Example:**
```bash
curl -H "Authorization: Bearer lm_your_api_key" \
  "https://api.latamatters.com/api/v1/data?country=AR&variable=Inflacion"
```

**Response:**
```json
{
  "status": "success",
  "metadata": {
    "total_records": 150,
    "generated_at": "2026-03-29T10:30:00.000Z"
  },
  "data": [
    {
      "country_code": "AR",
      "variable_name": "Inflacion",
      "version_id": "uuid",
      "last_updated": "2026-03-28T18:00:00.000Z",
      "rows": [
        {"año": 2020, "mes": "Enero", "valor": 42.0},
        {"año": 2020, "mes": "Febrero", "valor": 43.5}
      ]
    }
  ]
}
```

### 2. Download Files (Excel)

```http
GET /api/v1/files/download?country={code}
```

**Parameters:**
- `country` (optional): ISO 3166-1 alpha-2 code

**Example:**
```bash
curl -H "Authorization: Bearer lm_your_api_key" \
  "https://api.latamatters.com/api/v1/files/download?country=AR"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "files": [
      {
        "country_code": "AR",
        "last_updated": "2026-03-28T18:00:00.000Z",
        "download_url": "https://s3.amazonaws.com/...",
        "expires_in_hours": 24
      }
    ]
  }
}
```

## Common Country Codes

| Code | Country |
|------|---------|
| AR | Argentina |
| BO | Bolivia |
| BR | Brazil |
| CL | Chile |
| CO | Colombia |
| MX | Mexico |
| PE | Peru |

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Invalid API Key |
| 403 | No access to country |
| 404 | Data not found |
| 429 | Rate limit exceeded |

## Rate Limits

- 60 requests/minute
- 1,000 requests/hour
- 10,000 requests/day

## Quick Examples

### JavaScript
```javascript
const axios = require('axios');

const response = await axios.get('https://api.latamatters.com/api/v1/data', {
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  params: { country: 'AR', variable: 'Inflacion' }
});

console.log(response.data);
```

### Python
```python
import requests

response = requests.get(
    'https://api.latamatters.com/api/v1/data',
    headers={'Authorization': f'Bearer {API_KEY}'},
    params={'country': 'AR', 'variable': 'Inflacion'}
)

data = response.json()
print(data)
```

### Python + Pandas
```python
import requests
import pandas as pd

response = requests.get(
    'https://api.latamatters.com/api/v1/data',
    headers={'Authorization': f'Bearer {API_KEY}'},
    params={'country': 'AR', 'variable': 'Inflacion'}
)

df = pd.DataFrame(response.json()['data'][0]['rows'])
print(df.head())
```

## Full Documentation

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## Support

- **Email**: api-support@latamatters.com
- **Documentation**: https://docs.latamatters.com

---

**Need an API Key?** Contact your account manager at sales@latamatters.com
