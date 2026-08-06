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
      "median_subject_response_minutes": 0,
      "median_days_between_interactions": 0,
      "evidence_refs": [
        {
          "tenant_id": "tenant_001",
          "evidence_id": "evidence_001"
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
      "description": "Median subject response time: 12 minutes",
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
    "contacts_included": 0,
    "contacts_limit": 10,
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
- Todo `evidence_ref` debe resolver a un objeto de `evidence` del mismo tenant.
- Todas las métricas son deterministas y calculadas por backend.
- Ratios deben estar entre `0` y `1`.
- Conteos deben ser enteros mayores o iguales a `0`.
- Fechas deben usar UTC ISO-8601.
- `contacts_included` debe ser igual al número real de elementos de `contact_signals`.
- `contacts_included` no puede superar `contacts_limit`.
- El MVP incluye como máximo diez contactos.
- Este contrato no contiene inferencias semánticas ni etiquetas derivadas.

## Cobertura

```txt
< 20 mensajes válidos  → rechazo
20–99 mensajes válidos → partial
≥ 100 mensajes válidos → sufficient, sujeto a los demás mínimos
```

`coverage.status = sufficient` requiere además:

```txt
≥ 90 días cubiertos
≥ 20 conversaciones
≥ 5 contactos detectados
normalization_error_ratio ≤ 0.10
```

`coverage.status = partial` aplica cuando:

```txt
20–99 mensajes válidos
o no se cumple uno o más mínimos de sufficient
```

`coverage.status = insufficient` puede persistirse solo como resultado diagnóstico cuando el payload no fue rechazado por estructura, pero no habilita inferencia LLM ni persistencia de `operational_identity.v1`.

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
contacts_included distinto del tamaño de contact_signals
contacts_included mayor que contacts_limit
```

## Alcance MVP

- una ventana histórica;
- hasta diez contactos principales;
- cinco métricas base:
  - volumen;
  - enviados/recibidos;
  - iniciación;
  - tiempo de respuesta;
  - recurrencia;
- evidencia representativa;
- sin cierre de conversaciones;
- sin expansión de participantes;
- sin reactivación;
- sin `behavior_signals`;
- sin inferencia de rol;
- sin riesgos, presiones, compromisos, temas ni prioridades.
