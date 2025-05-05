#!/usr/bin/env python3
import sys
import tempfile
import ifcopenshell
import ifcopenshell.geom

# Типы, учитываемые при переносе GUID
EXCEPTION_TYPES = {"IfcProject", "IfcSite", "IfcBuilding"}

# -------------------
# Сбор старых элементов для замены GUID
# -------------------
def collect_old_elements(old_ifc):
    old_elements = {}
    seen_exceptions = set()
    for element in old_ifc:
        if not hasattr(element, "GlobalId"): continue
        etype = element.is_a()
        name = getattr(element, "Name", None)
        if name is None and etype not in EXCEPTION_TYPES:
            continue
        if name is None and etype in EXCEPTION_TYPES:
            if etype in seen_exceptions: continue
            seen_exceptions.add(etype)
        key = (etype, name)
        old_elements.setdefault(key, element)
    return old_elements

# -------------------
# Обновление GUID элементов нового файла (in-memory)
# -------------------
def update_all_guids(old_ifc, new_ifc):
    old_elements = collect_old_elements(old_ifc)
    seen_exceptions_new = set()
    to_update = []
    for el in new_ifc:
        if not hasattr(el, "GlobalId"): continue
        etype = el.is_a()
        name = getattr(el, "Name", None)
        if name is None and etype not in EXCEPTION_TYPES:
            continue
        if name is None and etype in EXCEPTION_TYPES:
            if etype in seen_exceptions_new: continue
            seen_exceptions_new.add(etype)
        to_update.append(el)

    updated = 0
    for el in to_update:
        key = (el.is_a(), getattr(el, "Name", None))
        if key in old_elements:
            el.GlobalId = old_elements[key].GlobalId
            updated += 1
    print(f"GUIDs updated: {updated}/{len(to_update)}")

# -------------------
# Модификация PropertySet и PipeFitting (in-memory)
# -------------------
def modify_property_set_names(ifc_file):
    partial_pset = "AVEVA_Pset"
    modified = False
    # Обрезаем имена PropertySet
    for pset in ifc_file.by_type("IfcPropertySet"):
        if partial_pset in pset.Name:
            pset.Name = partial_pset
            modified = True
    # Подсчёт повторяющихся имён PipeFitting
    counts = {}
    for elem in ifc_file.by_type('IfcPipeFitting'):
        counts[elem.Name] = counts.get(elem.Name, 0) + 1
    # Переименование PipeFitting
    for elem in ifc_file.by_type('IfcPipeFitting'):
        # Пропускаем элементы без представления
        if not getattr(elem, 'Representation', None):
            continue
        # Только многократные имена
        if counts.get(elem.Name, 0) <= 1:
            continue
        try:
            settings = ifcopenshell.geom.settings()
            shape = ifcopenshell.geom.create_shape(settings, elem)
            mats = getattr(shape.geometry, 'materials', [])
            if mats and mats[0].has_transparency:
                t = mats[0].transparency
                if 0 < t < 1 and not elem.Name.startswith("Insulation of"):
                    elem.Name = f"Insulation of {elem.Name}"
                    modified = True
        except Exception:
            # Если не удалось создать форму, пропускаем
            continue
    print("PropertySet and PipeFitting modifications applied" if modified else "No modifications applied.")

# -------------------
# Функция объединенной обработки
# -------------------
def process_ifc_files(old_path: str, new_path: str, output_path: str) -> None:
    """
    Выполняет два шага подряд:
      1. Обновление GUID из old_path в new_ifc
      2. Модификация имен PropertySet и PipeFitting
    Сохраняет результат в output_path.
    """
    old_ifc = ifcopenshell.open(old_path)
    new_ifc = ifcopenshell.open(new_path)

    update_all_guids(old_ifc, new_ifc)
    modify_property_set_names(new_ifc)

    new_ifc.write(output_path)
    print(f"Processing complete. Final file saved to: {output_path}")
