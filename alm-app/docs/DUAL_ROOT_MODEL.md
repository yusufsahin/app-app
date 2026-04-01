# Dört Kök Modeli (Four-Root)

## Overview

Her projede **dört kök artifact** vardır: **Root-Requirement** (Requirements ağacı), **Root-Tests** (Catalog / test-case ağacı), **Root-TestSuites** — manifest `tree_id: testsuites`, ürün dilinde **Campaign** ağacı (koleksiyonlar + suite/run/execution campaign) — ve **Root-Defect** (Defects ağacı). Proje oluşturulduğunda bu root’lar manifest `tree_roots` tanımına göre otomatik yaratılır.

## Davranış

- **Proje oluşturma:** Template atanmış projelerde `CreateProject` sonrası root artifact’lar oluşturulur:
  - `artifact_type=root-requirement`, `artifact_key={project_code}-R0`, `title=project.name`
  - `artifact_type=root-tests`, `artifact_key={project_code}-T0`, `title=project.name`
  - `artifact_type=root-testsuites`, `artifact_key={project_code}-TS0`, `title=project.name`
  - `artifact_type=root-defect`, `artifact_key={project_code}-D0`, `title=project.name` (manifest’te root-defect tanımlıysa)
- **Hiyerarşi:** Epic/feature/requirement `root-requirement` altında; `test-case` yalnızca `test-folder`/`root-tests` altında; `test-suite`/`test-run`/`test-campaign` yalnızca `testsuite-folder`/`root-testsuites` altında; defect/bug `root-defect` altında.
- **Koruma:** Root artifact’lar silinemez ve taşınamaz (parent_id null dışına çekilemez).
- **Liste filtre:** `GET /projects/{id}/artifacts?tree=requirement`, `?tree=tests`, `?tree=testsuites` veya `?tree=defect` ile sadece ilgili root’un altındaki artifact’lar döner.

## Glossary

- **Requirement artifact:** Root-Requirement altındaki iş öğeleri (epic, feature, requirement vb.).
- **Test artifact:** Root-Tests altındaki iş öğeleri (`test-folder`, `test-case`).
- **Campaign tree artifacts:** Root-TestSuites altındaki iş öğeleri (`testsuite-folder` = koleksiyon, `test-suite`, `test-run`, `test-campaign`).
- **Defect artifact:** Root-Defect altındaki hata/defect tipleri (defect, bug vb.).
- **Trace (relationship):** İki artifact arasındaki ilişki; `relationship_type` örn. `verifies`, `tests`, `blocks`. Requirement–quality ve defect–test izlenebilirliği için kullanılır.

## İleride

- Quality modülü (TestCase, TestRun, execution) Root-Quality altında genişleyecek.
- Trace için mevcut relationship modeli (`relationship_type=verifies` / `tests`) kullanılır; ek trace tablosu yok.
