import pandas as pd
import re

class AccountingParser:
    def __init__(self, raw_text):
        self.raw_text = raw_text
        self.data = []

    def _parse_amount(self, amount_str):
        if not amount_str:
            return 0.0
        try:
            # Remove spaces and change comma to dot
            clean_str = amount_str.replace(' ', '').replace(',', '.')
            return float(clean_str)
        except ValueError:
            return 0.0

    def parse(self):
        lines = self.raw_text.splitlines()
        i = 0

        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            # Находим строку, которая начинается с даты
            date_match = re.search(r'(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2})', line)
            if not date_match:
                i += 1
                continue

            date_str = date_match.group(1).split()[0]

            # Извлекаем основные поля из этой строки
            # Регулярное выражение стало более гибким для счетов и сумм
            match = re.search(
                r';([^;]*);'                                      # Документ
                r'([^;]*);'                                      # Содержание
                r'([\d.]+);;'                                    # Дт (счет)
                r'([\d.]+);;'                                    # Кт (счет)
                r'([-]?[\d\s,.]+);'                                  # Сумма
                r'([^;]*);'                                      # Субконто Дт
                r'([^;]*)', line                                 # Субконто Кт
            )

            if match:
                doc, content, dt, kt, amount, sub_dt, sub_kt = match.groups()
            else:
                # Если не удалось распарсить основную строку — пробуем найти минимум
                doc = content = sub_dt = sub_kt = ""
                dt = kt = "3100.3110"
                amount = "0"

            entry = {
                'Дата': date_str,
                'Документ': doc.strip().strip('"'),
                'Содержание': content.strip(),
                'Дт': dt,
                'Кт': kt,
                'Сумма': self._parse_amount(amount),
                'Субконто_Дт': sub_dt.strip().strip('"'),
                'Субконто_Кт': sub_kt.strip().strip('"'),
                'Валюта': 'Сом',
                'Договор': '',
                'Журнал': ''
            }

            i += 1

            # Собираем следующие строки до следующей даты
            while i < len(lines):
                next_line = lines[i].strip()
                if not next_line:
                    i += 1
                    continue

                if re.search(r'\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}', next_line):
                    break

                # Валюта
                val = re.search(r'Валюта[:;\s]+([A-Z]{3})', next_line)
                if val:
                    entry['Валюта'] = val.group(1)

                # Договор
                if 'Договор' in next_line or 'Контракт' in next_line:
                    entry['Договор'] = next_line.strip()

                # Журнал
                j = re.search(r';([А-Я]{2})$', next_line)
                if j:
                    entry['Журнал'] = j.group(1)

                i += 1

            self.data.append(entry)

        df = pd.DataFrame(self.data)
        print(f"Найдено проводок: {len(df)}")
        return df


# ====================== ЗАПУСК ======================
if __name__ == "__main__":
    import os
    
    csv_file_path = '3100март.csv'
    
    if not os.path.exists(csv_file_path):
        print(f"Файл {csv_file_path} не найден в текущей директории.")
    else:
        # Попробуем cp1251 (Windows-1251) для русских CSV
        try:
            with open(csv_file_path, 'r', encoding='cp1251') as f:
                raw_data = f.read()
        except UnicodeDecodeError:
            with open(csv_file_path, 'r', encoding='utf-8') as f:
                raw_data = f.read()

        parser = AccountingParser(raw_data)
        df_parsed = parser.parse()

        print("\nПервые 15 строк результата:")
        print(df_parsed.head(15))
        print(f"\nИтого строк: {len(df_parsed)}")