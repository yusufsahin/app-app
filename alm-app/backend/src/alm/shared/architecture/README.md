# ALM Backend — DDD Enterprise Clean Architecture

Bu modül, alm-manifest-app backend mimarisinin DDD (Domain-Driven Design) ve Enterprise Clean Architecture prensiplerine göre dokümante edilmiş referansıdır.

## Katmanlar ve Bağımlılık Yönü

```
┌─────────────────────────────────────────────────────────────┐
│  API (FastAPI Routers, Pydantic Schemas)                    │
├─────────────────────────────────────────────────────────────┤
│  Application (Commands, Queries, Handlers, DTOs)            │
├─────────────────────────────────────────────────────────────┤
│  Domain (Entities, Aggregates, Value Objects, Ports,        │
│          Domain Events, Specifications, Domain Services)    │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure (Repositories, ORM Models, Event Dispatcher,│
│                  Unit of Work, External Adapters)           │
└─────────────────────────────────────────────────────────────┘

Bağımlılık yönü: Dıştan içe (Infrastructure → Domain’e implement eder)
```

**Domain hiçbir katmana bağımlı değildir.** Application ve Infrastructure, Domain’deki portları (interfaces) implement eder.

## Bounded Contexts (BC)

| BC | Modül | Açıklama |
|----|-------|----------|
| Auth | `alm.auth` | Kimlik doğrulama, token, profil |
| Tenant | `alm.tenant` | Organizasyon, üyelik, roller, RBAC |
| Project | `alm.project` | Proje CRUD, manifest |
| Artifact | `alm.artifact` | İş öğeleri, workflow, geçişler |
| Process | `alm.process_template` | Süreç şablonları, manifest bundle |
| FormSchema | `alm.form_schema` | Manifest-driven form meta verisi |
| Shared | `alm.shared` | Ortak domain primitives, mediator, audit |

## Temel Pattern'lar

### 1. Aggregate Root
- `AggregateRoot(BaseEntity)` — Domain event kaydı, `collect_events()`
- Örnek: `Project`, `Artifact`, `User`, `Tenant`, `Role`

### 2. Repository Port
- `domain/ports.py` — Soyut repository interface
- `infrastructure/repositories.py` — SQLAlchemy implementasyonu

### 3. CQRS
- **Command**: `Command` (frozen dataclass) → `CommandHandler.handle(command)`
- **Query**: `Query` → `QueryHandler.handle(query)`
- **Mediator**: `send(command)` / `query(query)` — handler factory ile wiring

### 4. Unit of Work
- `IUnitOfWork` — Port: `commit()`, `rollback()`, `session`
- `SqlAlchemyUnitOfWork` — AsyncSession adapter
- Mediator, commit öncesi audit; commit sonrası event dispatch

### 5. Domain Events
- `DomainEvent` — Base: `event_id`, `occurred_at`, `schema_version`
- Aggregate: `_register_event()`, `collect_events()`
- `IDomainEventDispatcher` — Port: `dispatch(events)`
- `register_event_handler(event_type, handler)` — Startup’ta kayıt
- Mediator commit sonrası `_dispatch_collected_events()` çağırır

### 6. Specification Pattern
- `Specification[T]` — `is_satisfied_by(candidate)`, `and_spec()`, `or_spec()`
- `AndSpecification`, `OrSpecification` — Birleşim
- Örnek: `ArtifactInProjectSpec`, `ArtifactInStateSpec`

### 7. Value Objects
- `shared.domain.value_objects`: `ProjectCode`, `Slug`, `Email`, `TenantId`, `UserId`
- Immutable, validation ile oluşturulur

## Başlangıç Akışı

1. `main.create_app()` → `register_all_handlers()`
2. `register_all_handlers()`:
   - Domain Event Dispatcher kurulur, event handler’lar kaydedilir
   - Command/Query handler factory’leri Mediator’a kaydedilir
3. Request: `get_mediator()` → `Mediator(session)`
4. Command: `mediator.send(command)` → handler → audit → commit → event dispatch
5. Query: `mediator.query(query)` → handler → DTO döner (commit yok)

## Yeni Modül Eklerken

1. `domain/entities.py` — Aggregates / Entities
2. `domain/ports.py` — Repository port’ları
3. `domain/events.py` — Domain event’ler
4. `application/commands/` — Command + Handler
5. `application/queries/` — Query + Handler
6. `infrastructure/models.py` — ORM modelleri
7. `infrastructure/repositories.py` — Port implementasyonu
8. `config/handler_registry.py` — Handler factory kaydı
