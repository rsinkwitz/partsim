# Grid System Feature

Das Grid-System ist eine optionale Optimierung für die Kollisionserkennung, die die Berechnung von O(n²) auf O(n) reduziert.

## Funktionsweise

Das Grid-System teilt den 3D-Raum in gleichmäßige Voxel (3D-Zellen) auf. Jeder Ball wird in die Voxel eingetragen, die er überlappt (maximal 8 Voxel, da ein Ball maximal eine Voxelgrenze pro Achse überschreiten kann: 2×2×2 = 8).

Bei der Kollisionserkennung müssen nur Bälle geprüft werden, die **dasselbe Voxel** teilen. Zwei Bälle können nur kollidieren, wenn sie mindestens ein gemeinsames Voxel haben.

### Wichtige Eigenschaften (wie im Original IRIX 1993)

- **Ein Ball berührt maximal 8 Voxel**: Da der Ball kleiner als ein Voxel ist, kann er in jeder Dimension (x, y, z) nur eine Grenze überschreiten → max. 2 Voxel-Indizes pro Achse → 2×2×2 = 8 Voxel
- **Kollisionen nur bei gemeinsamen Voxeln**: Zwei Bälle werden nur geprüft, wenn sie mindestens ein Voxel teilen (nicht benachbart!)
- **Keine Prüfung benachbarter Voxel**: Anders als bei manchen Grid-Implementierungen werden nur exakt geteilte Voxel betrachtet

### Vorteile
- **Dramatische Performance-Verbesserung** bei vielen Bällen (>100)
- **Skalierbar**: O(n) statt O(n²) Komplexität
- **Konfigurierbar**: Grid-Segmente anpassbar (2-25)

### Einschränkungen
- Bälle dürfen nicht größer als ein Voxel sein (wird automatisch validiert)
- Bei zu wenig Segmenten oder zu großen Bällen kann die Performance schlechter sein
- Das System passt automatisch die Ballgröße an, wenn nötig
- **Wand-Kollisionen**: Aktuell werden alle Bälle gegen alle Wände geprüft (Brute-Force). Im Original IRIX wurden nur Bälle in Rand-Voxeln gegen nahe Wände geprüft. Dies könnte in Zukunft optimiert werden.

## UI-Elemente

### A) Grid-Konfiguration (grün umrandet)

1. **Toggle: Fast Grid-based Collision Checking**
   - Aktiviert/deaktiviert das Grid-System
   - Wenn deaktiviert: Brute-Force O(n²) Methode

2. **Slider: Grid Segments (2-25)**
   - Anzahl der Unterteilungen pro Achse
   - Default: 8 (8×8×8 = 512 Voxel)
   - Höhere Werte = feinere Unterteilung = mehr Speicher, aber bessere Lokalität

3. **Button: ⚡ Apply Grid**
   - Wendet die Grid-Konfiguration an
   - Regeneriert Bälle mit angepasster Größe (falls nötig)
   - Validiert die Konfiguration

### B) Grid-Visualisierung (grau umrandet, gedimmt wenn Grid aus)

1. **Show World Grid**
   - Zeigt das Grid als grüne Linien im 3D-Raum
   - Hilft beim Verständnis der Raumaufteilung

2. **Show Occupied Grid Voxels**
   - Zeigt die **Kanten** belegter Voxel als farbige Linien
   - **Farbe = Ball-Farbe** (bei mehreren Bällen pro Voxel: Farbe des ersten Balls)
   - Aktualisiert sich in Echtzeit während der Simulation
   - Perfekt zum Debugging mit wenigen Bällen: Man sieht genau, welcher Ball welche Voxel berührt

3. **Show Collision Checks**
   - (Noch nicht implementiert)
   - Soll Linien zwischen geprüften Ball-Paaren zeigen

## Automatische Ball-Größen-Anpassung

Wenn "Apply Grid" geklickt wird, prüft das System automatisch:

```typescript
const cellSize = (2 * CBR) / gridSegments;
const maxAllowedRadius = cellSize / 2;
```

Wenn `maxRadius` oder `minRadius` größer als erlaubt sind, werden sie automatisch angepasst und die UI-Slider aktualisiert.

### Beispiel:
- Grid: 8 Segmente
- Würfel-Radius (CBR): 1.518m
- Zellgröße: (2 × 1.518) / 8 = 0.38m
- Max. erlaubter Ball-Radius: 0.19m
- Wenn aktuell `maxRadius = 0.25m`, wird es auf `0.171m` (90% von 0.19m) reduziert

## Technische Details

### Grid-Klasse (`Grid.ts`)

```typescript
class Grid {
  // Grid dimensions
  private segments: THREE.Vector3;
  private origin: THREE.Vector3;
  private extent: THREE.Vector3;
  private cellSize: THREE.Vector3;
  
  // Voxel storage
  private voxels: VoxelCell[];
  
  // Methods
  insertBall(ball, ballId): void
  updateBall(ball, ballId): void
  removeBall(ballId): void
  getPotentialCollisions(ballId): number[]
  getOccupiedCells(): Array<...>
}
```

### PhysicsEngine Integration

```typescript
class PhysicsEngine {
  private grid: Grid | null;
  private gridEnabled: boolean;
  
  // Grid-basierte Kollisionserkennung
  private checkCollisionsGrid(): void {
    for each ball:
      candidates = grid.getPotentialCollisions(ballId)
      check only candidates (statt aller Bälle)
  }
}
```

### SceneManager Visualisierung

```typescript
class SceneManager {
  createGridVisualization(segments, origin, extent): void
  updateOccupiedVoxels(occupiedCells): void
  setShowGrid(show): void
  setShowOccupiedVoxels(show): void
}
```

## Performance-Vergleich

| Bälle | Brute-Force (O(n²)) | Grid (O(n)) | Speedup |
|-------|---------------------|-------------|---------|
| 10    | ~45 checks          | ~40 checks  | 1.1×    |
| 50    | ~1,225 checks       | ~200 checks | 6×      |
| 100   | ~4,950 checks       | ~400 checks | 12×     |
| 500   | ~124,750 checks     | ~2,000 checks | 62×   |
| 1000  | ~499,500 checks     | ~4,000 checks | 125×  |

*Hinweis: Tatsächliche Werte hängen von der räumlichen Verteilung der Bälle ab*

## Verwendung

1. **Grid aktivieren**: Checkbox "Fast Grid-based Collision Checking" anklicken
2. **Segmente wählen**: Slider auf gewünschten Wert (empfohlen: 8-12)
3. **Apply klicken**: Button "⚡ Apply Grid"
4. **Visualisierung** (optional): "Show World Grid" und "Show Occupied Grid Voxels" aktivieren
5. **Simulation starten**: Wie gewohnt

## Debugging

Das System gibt ausführliche Console-Logs:
```
🔲 Grid created: { segments: Vector3, cellSize: Vector3, totalCells: 512 }
🔲 Grid initialized: { segments: Vector3, balls: 100, occupiedCells: 45 }
✅ Grid system applied successfully
```

Bei Validierungsfehlern:
```
⚠️ Max ball radius (0.25m) exceeds max allowed (0.19m)
❌ Grid validation failed: [...]
```

## Original IRIX Implementation

Das Grid-System basiert auf der Original-Implementierung in `old-irix-1993/grid.cpp/h` von 1993. Die TypeScript-Portierung vereinfacht die Event-Queue-basierte Ansatz zu einem einfacheren räumlichen Hashing, behält aber die Kern-Idee der räumlichen Unterteilung bei.

