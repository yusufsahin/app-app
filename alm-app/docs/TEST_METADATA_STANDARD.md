# Test case metadata standardı

**Plan ile hizalama:** `artifact_type` / `artifact_id` bağlamı `test_manifest.yaml` içinde `artifact_refs` + `suite_type` ile verilir; sürüm bilgisi satır bazında:

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| `test_id` | Evet | Benzersiz kimlik |
| `suite_type` | Evet | `schema` \| `semantic` \| … |
| `artifact_refs` | Evet | Katalogdaki `artifact_id` listesi |
| `criticality` | Evet | `critical` \| `high` \| `medium` \| `low` |
| `risk_level` | Hayır | Varsa `criticality` ile **aynı** olmalı |
| `dsl_version` | Otomasyon için evet | DSL sürümü (string) |
| `rule_pack_version` | Otomasyon için evet | Rule pack sürümü (string) |
| `automation` | Evet | `true` \| `false` |
| pytest eşlemesi | `automation: true` ise | `pytest_node_id`, `pytest_classname`, `pytest_test_name` |

Doğrulama: `scripts/validate_metadata.py`.
