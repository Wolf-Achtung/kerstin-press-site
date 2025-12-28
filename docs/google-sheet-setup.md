# Google Sheet Setup für Kerstin's Website

## 1. Neues Google Sheet erstellen

Erstelle ein neues Google Sheet mit dem Namen: **"Kerstin Website Content"**

## 2. Spalten anlegen (Zeile 1 = Überschriften)

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| **position** | **spalte** | **typ** | **medium** | **titel_de** | **titel_en** | **datum** | **bild_url** | **link** | **zitat_de** | **zitat_en** |

## 3. Beispiel-Daten (ab Zeile 2)

```
position | spalte | typ   | medium          | titel_de                    | titel_en                      | datum      | bild_url                        | link | zitat_de                           | zitat_en
1        | links  | bild  | FAZ Magazin     | Titelstory: Kerstin Geffert | Cover Story: Kerstin Geffert  | 2023-01-01 | https://drive.google.com/...    |      |                                    |
2        | rechts | bild  | Lifestyle Magazin| Stil-Inspiration            | Style Inspiration             | 2025-07-12 | https://drive.google.com/...    |      |                                    |
3        | links  | zitat |                 |                             |                               |            |                                 |      | Mode ist mehr als Kleidung...      | Fashion is more than clothing...
4        | rechts | zitat |                 |                             |                               |            |                                 |      | Mit ihrer einzigartigen Mischung...| With her unique blend...
5        | links  | video | Fashion-TV      | Exklusiv-Interview          | Exclusive Interview           |            |                                 | https://youtube.com/watch?v=xxx |  |
```

## 4. Sheet öffentlich machen

1. Klick auf **"Freigeben"** (oben rechts)
2. Klick auf **"Allgemeiner Zugriff ändern"**
3. Wähle: **"Jeder mit dem Link"** → **"Betrachter"**
4. Kopiere die Sheet-ID aus der URL:
   ```
   https://docs.google.com/spreadsheets/d/HIER_IST_DIE_ID/edit
   ```

## 5. Sheet-ID in Website eintragen

Die Sheet-ID muss in `index.html` eingetragen werden (einmalig).

---

## Spalten-Erklärung

| Spalte | Beschreibung | Beispiel |
|--------|--------------|----------|
| **position** | Reihenfolge (1 = oben) | `1`, `2`, `3` |
| **spalte** | Wo erscheint es? | `links` oder `rechts` |
| **typ** | Art des Inhalts | `bild`, `zitat`, `video` |
| **medium** | Name der Publikation | `FAZ Magazin`, `Vogue` |
| **titel_de** | Deutscher Titel | `Titelstory: Kerstin` |
| **titel_en** | Englischer Titel | `Cover Story: Kerstin` |
| **datum** | Erscheinungsdatum | `2025-01-15` |
| **bild_url** | Link zum Bild | Google Drive Link |
| **link** | Video-URL oder Artikel-Link | YouTube Link |
| **zitat_de** | Deutsches Zitat | `"Mode ist..."` |
| **zitat_en** | Englisches Zitat | `"Fashion is..."` |

---

## Bilder in Google Drive hochladen

1. Bild in Google Drive hochladen
2. Rechtsklick → **"Freigeben"** → **"Jeder mit dem Link"**
3. Rechtsklick → **"Link abrufen"**
4. Link umwandeln:
   - Original: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
   - Für Website: `https://drive.google.com/uc?export=view&id=FILE_ID`

---

## Video-Links

YouTube-Links so eintragen wie sie sind:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`

Die Website wandelt sie automatisch in Embed-Links um.
