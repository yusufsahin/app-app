# Üç Kök Modeli (Three-Root)

## Overview

Her projede **üç kök artifact** vardır: **Root-Requirement** (Requirements ağacı), **Root-Quality** (Quality ağacı) ve **Root-Defect** (Defects ağacı). Proje oluşturulduğunda bu üç root otomatik yaratılır; requirement, quality ve defect hiyerarşileri bu köklere bağlanır.

## Davranış

- **Proje oluşturma:** Template atanmış projelerde `CreateProject` sonrası üç artifact oluşturulur:
  - `artifact_type=root-requirement`, `artifact_key={project_code}-R0`, `title=project.name`
  - `artifact_type=root-quality`, `artifact_key={project_code}-Q0`, `title=project.name`
  - `artifact_type=root-defect`, `artifact_key={project_code}-D0`, `title=project.name` (manifest’te root-defect tanımlıysa)
- **Hiyerarşi:** Epic, feature, requirement gibi tipler `parent_types: ["root-requirement"]` ile R0 altında; defect/bug `parent_types: ["root-defect"]` ile D0 altında. İleride TestCase vb. `root-quality` altında tanımlanacak.
- **Koruma:** Root artifact’lar silinemez ve taşınamaz (parent_id null dışına çekilemez).
- **Liste filtre:** `GET /projects/{id}/artifacts?tree=requirement`, `?tree=quality` veya `?tree=defect` ile sadece ilgili root’un altındaki artifact’lar döner.

## Glossary

- **Requirement artifact:** Root-Requirement altındaki iş öğeleri (epic, feature, requirement vb.).
- **Quality artifact:** Root-Quality altındaki iş öğeleri (ileride TestCase, TestSuite vb.).
- **Defect artifact:** Root-Defect altındaki hata/defect tipleri (defect, bug vb.).
- **Trace (artifact link):** İki artifact arasındaki ilişki; `link_type` örn. `verifies`, `tests`, `blocks`. Requirement–quality ve defect–test izlenebilirliği için kullanılır.

## İleride

- Quality modülü (TestCase, TestRun, execution) Root-Quality altında genişleyecek.
- Trace için mevcut artifact link (`link_type=verifies` / `tests`) kullanılır; ek trace tablosu yok.
