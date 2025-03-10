import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.guid
import os
import openpyxl

ifc_file = ifcopenshell.open("model.ifc")
wb = openpyxl.load_workbook("attributes.xlsx")    #НУЖНО ОТКРЫВАТЬ С ПУТЕМ И НАЗВАНИЕМ ОТ ПОЛЬЗОВАТЕЛЯ
ws = wb['BPIPPIPE']  # Берем активный лист

id_col = "D"   # Уникальный идентификатор
length_col = "O"  # Длина трубы (Pipe Length)
diameter_col = "P"  # Диаметр трубы (Pipe Diameter)



def create_property(ifc_file, name, value):
    return ifc_file.create_entity("IfcPropertySingleValue", Name=name, NominalValue=ifcopenshell.util.element.serialize_value(value))

# Перебираем строки с данными, начиная со 2-й (первая — заголовки)
for row in ws.iter_rows(min_row=2, values_only=True):
    globalid = row[3]  # Столбец D (нумерация с 0, значит D — это 3)
    pipe_length = row[14]  # Столбец O (нумерация с 0, значит O — это 14)
    pipe_diameter = row[15]  # Столбец P (нумерация с 0, значит P — это 15)

    if globalid:
        # Ищем объект в IFC по GlobalId
        element = ifc_file.by_guid(globalid)
        
        if element:
            # Создаем набор свойств
            prop_set = ifc_file.create_entity("IfcPropertySet", GlobalId=ifcopenshell.guid.new(), Name="PipeProperties", HasProperties=[
                create_property(ifc_file, "Pipe Length", pipe_length),
                create_property(ifc_file, "Pipe Diameter", pipe_diameter)
            ])
            
            # Привязываем свойства к объекту
            ifc_file.create_entity("IfcRelDefinesByProperties", GlobalId=ifcopenshell.guid.new(), RelatingPropertyDefinition=prop_set, RelatedObjects=[element])

# Сохранение обновленного IFC-файла
ifc_file.write("updated_model.ifc")

print("IFC-модель обновлена и сохранена как 'updated_model.ifc'")