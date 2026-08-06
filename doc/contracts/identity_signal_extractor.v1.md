# `identity_signal_extractor.v1`

## Propósito

Contrato determinista del Motor 1 — `Operational Identity Discovery`.

Sintetiza señales estructurales de comunicación para que un LLM infiera la identidad operacional del usuario.

No interpreta roles, jerarquías, presiones, riesgos, temas ni prioridades.

## Flujo

```txt
canonical_communication.v1
↓
identity_signal_extractor.v1
↓
LLM
↓
operational_identity.v1
↓
validador backend
```

## Contrato

```json
{
  "schema_version": "identity_signal_extractor.v1",
  "tenant_id": "tenant_001",
  "subject_id": "person_user_001",
  "window": {
    "from": "2026-01-01T00:00:00Z",
    "to": "2026-07-31T23:59:59Z"
  },
  "metrics": {
    "messages_total": 0,
    "messages_sent": 0,
    "messages_received": 0,
    "conversations_total": 0,
    "active_days": 0
  },
  "contact_signals": [
    {
      "tenant_id": "tenant_001",
      "contact_id": "person_001",
      "internal_external": "internal",
      "messages_sent_by_subject": 0,
      "messages_received_by_subject": 0,
      "conversations_shared": 0,
      "subject_initiated_conversations": 0,
      "contact_initiated_conversations": 0,
      "subject_closed_conversations": 0,
      "contact_closed_conversations": 0,
      "median_subject_response_minutes": 0,
      "recurrence_days": 0,
      "participant_expansion_count": 0,
      "evidence_refs": [
        {
          "tenant_id": "tenant_001",
          "evidence_id": "evidence_001"
        }
      ]
    }
  ],
  "behavior_signals": [
    {
      "tenant_id": "tenant_001",
      "signal_id": "behavior_001",
      "type": "high_response_priority",
      "contact_id": "person_001",
      "value": 0.82,
      "evidence_refs": [
        {
          "tenant_id": "tenant_001",
          "evidence_id": "metric_001"
        }
      ]
    }
  ],
  "evidence": [
    {
      "tenant_id": "tenant_001",
      "evidence_id": "metric_001",
      "type": "metric",
      "entity_type": "contact",
      "entity_id": "person_001",
      "description": "Median response time: 12 minutes",
      "source_entity_refs": [
        {
          "tenant_id": "tenant_001",
          "entity_type": "message",
          "entity_id": "message_001"
        },
        {
          "tenant_id": "tenant_001",
          "entity_type": "message",
          "entity_id": "message_002"
        }
      ]
    }
  ],
  "coverage": {
    "messages_processed": 0,
    "conversations_processed": 0,
    "contacts_detected": 0,
    "top_contacts_included": 10,
    "date_coverage_ratio": 0.97,
    "normalization_error_ratio": 0.01,
    "status": "sufficient"
  }
}
```

## Enums

### `internal_external`

```txt
internal
external
unknown
```

### `behavior_signals.type`

```txt
high_response_priority
high_interaction_frequency
high_reciprocity
conversation_initiator
conversation_closer
participant_expander
conversation_reactivator
```

### `evidence.type`

```txt
metric
message
conversation
```

### `coverage.status`

```txt
sufficient
partial
insufficient
```

## Reglas

- `tenant_id` es obligatorio en la raíz, entidades internas y referencias.
- El backend inyecta `tenant_id` desde el contexto autenticado.
- El backend no confía en un `tenant_id` producido o modificado por el LLM.
- `tenant_id + subject_id + window` identifican una ejecución.
- Todos los IDs y referencias deben pertenecer al mismo tenant.
- Un `contact_id` aparece una sola vez en `contact_signals`.
- Todo `behavior_signal` debe incluir al menos un `evidence_ref`.
- Todo `evidence_ref` debe resolver a un objeto de `evidence` del mismo tenant.
- Todas las métricas son deterministas y calculadas por backend.
- Ratios y valores normalizados deben estar entre `0` y `1`.
- Conteos deben ser enteros mayores o iguales a `0`.
- Fechas deben usar UTC ISO-8601.
- El MVP incluye como máximo diez contactos.
- Este contrato no contiene inferencias semánticas.

## Cobertura mínima

`coverage.status = sufficient` requiere:

```txt
≥ 90 días cubiertos
≥ 100 mensajes válidos
≥ 20 conversaciones
≥ 5 contactos
normalization_error_ratio ≤ 0.10
```

## Condiciones de rechazo

```txt
tenant_id ausente
subject_id ausente
ventana inválida
IDs duplicados
referencias inexistentes
conteos negativos
ratios fuera de rango
cruce de tenant
menos de 20 mensajes válidos
```

## Alcance MVP

- una ventana histórica;
- diez contactos principales;
- cinco métricas base;
- evidencia representativa;
- sin inferencia de rol;
- sin riesgos, presiones, compromisos, temas ni prioridades.
