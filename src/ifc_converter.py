import ifcopenshell
import ifcopenshell.guid
import openpyxl

def load_ifc_model(ifc_file_path):
    """Загружает IFC-модель из файла."""
    try:
        model = ifcopenshell.open(ifc_file_path)
        return model
    except Exception as e:
        return None

def read_xlsx(file_path):
    """
    Читает Excel-файл и возвращает список словарей.
    Ожидаемые колонки: Item Description, User Tag number, Pipe length, Pipe diameter.
    """
    try:
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active
        data = []
        for row in ws.iter_rows(min_row=11, values_only=True):  # Пропускаем заголовок
            record = {
                "item_desc": row[2],  # Название компонента
                "user_tag": row[3],   # Ожидаемый GUID компонента
                "length": row[14],    # Длина трубы в метрах
                "diameter": row[15]   # Диаметр трубы в метрах
            }
            data.append(record)
        return data
    except Exception as e:
        return []

def find_pipe_elements(ifc_file):
    """
    Находит все элементы PIPE (IfcElementAssembly), в имени которых содержится "PIPE".
    """
    try:
        pipe_elements = [el for el in ifc_file.by_type("IfcElementAssembly")
                         if el.Name and "PIPE" in el.Name.upper()]
        return pipe_elements
    except Exception as e:
        return []

def extract_component_elements(pipe_elements):
    """
    Для каждого PIPE-элемента находит его компонентные элементы (IfcElementAssembly)
    и возвращает словарь вида:
        {Item Description: GUID}
    где ключ – имя компонента, а значение – его GlobalId.
    """
    comp_map = {}
    for pipe in pipe_elements:
        for rel in getattr(pipe, "IsDecomposedBy", []):
            for comp in getattr(rel, "RelatedObjects", []):
                if comp.is_a("IfcElementAssembly"):
                    comp_name = comp.Name
                    comp_map[comp_name] = comp.GlobalId
    return comp_map

def update_ifc_properties(ifc_file, comp_map, xlsx_data):
    """
    Для каждой записи из XLSX ищет компонент, у которого:
      - Имя совпадает с Item Description
      - GlobalId совпадает с User Tag number
    Если такой компонент найден, к нему добавляются/обновляются свойства:
      - PipeLength (значение из столбца Pipe length * 1000, перевод в мм)
      - PipeDiameter (значение из столбца Pipe diameter * 1000, перевод в мм)
    """
    for record in xlsx_data:
        item_desc = record["item_desc"]
        user_tag = str(record["user_tag"])  # Ожидается GUID как строка
        length = record["length"]
        diameter = record["diameter"]

        if item_desc in comp_map:
            actual_guid = comp_map[item_desc]
            if str(actual_guid) == user_tag:
                component = ifc_file.by_guid(actual_guid)
                if component:
                    converted_length = length * 1000 if length is not None else None
                    converted_diameter = diameter if diameter is not None else None
                    update_or_create_property(ifc_file, component, "PipeLength", converted_length)
                    update_or_create_property(ifc_file, component, "PipeDiameter", converted_diameter)
            else:
                pass
        else:
            pass

def wrap_ifc_value(ifc_file, val):
    """
    Оборачивает значение в сущность IFC, если требуется.
    Для чисел пытается создать сущность IfcReal, для строк — IfcLabel.
    Если создание сущности не удается, возвращается исходное значение.
    """
    try:
        if isinstance(val, (int, float)):
            return ifc_file.create_entity("IfcReal", val)
        elif isinstance(val, str):
            return ifc_file.create_entity("IfcLabel", val)
        else:
            return val
    except Exception as e:
        return val

def get_length_unit(ifc_file):
    """
    Ищет в модели единицу измерения для длины (IfcSIUnit с UnitType "LENGTHUNIT").
    Если не найдена подходящая, возвращает созданную единицу METRE.
    """
    for unit in ifc_file.by_type("IfcSIUnit"):
        try:
            if unit.UnitType.upper() == "LENGTHUNIT":
                return unit
        except Exception:
            continue
    return ifc_file.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Name="METRE", Prefix=None)

def update_or_create_property(ifc_file, element, prop_name, prop_value):
    """
    Добавляет или обновляет свойство в PropertySet для элемента.
    Если PropertySet 'Pset_PipeProperties' отсутствует, создаётся новый.
    Значение свойства оборачивается с помощью wrap_ifc_value.
    Для Unit используется экземпляр IfcSIUnit, полученный через get_length_unit.
    При добавлении нового свойства, HasProperties обновляется через преобразование кортежа в список.
    """
    pset_name = "Pset_PipeProperties"
    existing_pset = None
    for rel in getattr(element, "IsDefinedBy", []):
        if (rel.is_a("IfcRelDefinesByProperties") and 
            rel.RelatingPropertyDefinition.is_a("IfcPropertySet") and 
            rel.RelatingPropertyDefinition.Name == pset_name):
            existing_pset = rel.RelatingPropertyDefinition
            break

    if not existing_pset:
        existing_pset = ifc_file.create_entity("IfcPropertySet",
                                               Name=pset_name,
                                               Description=None,
                                               HasProperties=())
        ifc_file.create_entity("IfcRelDefinesByProperties",
                               Name=None,
                               Description=None,
                               RelatedObjects=[element],
                               RelatingPropertyDefinition=existing_pset)

    existing_property = None
    for prop in existing_pset.HasProperties:
        if prop.Name == prop_name:
            existing_property = prop
            break

    wrapped_value = wrap_ifc_value(ifc_file, prop_value)
    length_unit = get_length_unit(ifc_file)
    if existing_property:
        existing_property.NominalValue = wrapped_value
    else:
        new_property = ifc_file.create_entity("IfcPropertySingleValue",
                                              Name=prop_name,
                                              Description=None,
                                              NominalValue=wrapped_value,
                                              Unit=length_unit)
        props_list = list(existing_pset.HasProperties) if existing_pset.HasProperties else []
        props_list.append(new_property)
        existing_pset.HasProperties = tuple(props_list)

def fix_cyrillic_header(ifc_file):
    """
    Обновляет заголовок IFC-файла для корректного сохранения кириллицы.
    В данном методе все строки заголовка перекодируются в CP1251.
    """
    try:
        # Обновляем FILE_NAME
        file_name = list(ifc_file.header["FILE_NAME"])
        new_file_name = []
        for s in file_name:
            if isinstance(s, str):
                new_file_name.append(s.encode('cp1251', errors='replace').decode('cp1251'))
            else:
                new_file_name.append(s)
        if len(new_file_name) < 7:
            new_file_name.extend(["CP1251"] * (7 - len(new_file_name)))
        else:
            new_file_name[6] = "CP1251"
        ifc_file.header["FILE_NAME"] = tuple(new_file_name)

        # Обновляем FILE_DESCRIPTION
        file_description = list(ifc_file.header["FILE_DESCRIPTION"])
        new_file_description = []
        for s in file_description:
            if isinstance(s, str):
                new_file_description.append(s.encode('cp1251', errors='replace').decode('cp1251'))
            else:
                new_file_description.append(s)
        if len(new_file_description) < 2:
            new_file_description.append("CP1251")
        else:
            new_file_description[1] = "CP1251"
        ifc_file.header["FILE_DESCRIPTION"] = tuple(new_file_description)
    except Exception as e:
        pass

def convert_excel_to_ifc(ifc_model, exceltab, output):
    ifc_file = load_ifc_model(ifc_model)
    if ifc_file is None:
        return

    xlsx_data = read_xlsx(exceltab)
    if not xlsx_data:
        return

    pipe_elements = find_pipe_elements(ifc_file)
    comp_map = extract_component_elements(pipe_elements)
    update_ifc_properties(ifc_file, comp_map, xlsx_data)
    
    fix_cyrillic_header(ifc_file)
    
    ifc_file.write(output)
