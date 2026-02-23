# Physics Parameters Explained

## Gravity

### Gravity Direction
**Location:** Model Section → Physics → Gravity Direction

**Options:**
- 🚫 **Zero** - No gravity
- ⬇️ **Down** - Standard (Earth-like, -Y direction)
- ⬆️ **Up** - Upward gravity (+Y direction)
- ⬅️ **Left** - Left gravity (-X direction)
- ➡️ **Right** - Right gravity (+X direction)
- 🔽 **Front** - Toward camera (+Z direction)
- 🔼 **Rear** - Away from camera (-Z direction)

**Effect:** Sets the direction of gravitational acceleration. Works immediately.

### Gravity Magnitude
**Location:** Model Section → Physics → Gravity Magnitude

**Range:** 0 - 20 m/s²  
**Default:** 9.81 m/s² (Earth gravity)  
**Step:** 0.1 m/s²

**Effect:** 
- Controls the **strength** of gravity
- Works **immediately** (live effect)
- Independent of Gravity Direction
- **Important:** The "G" keyboard shortcut toggles between ZERO and DOWN using the **current magnitude**
  - If you set magnitude to 0.1 and press "G", balls will fall with 0.1 m/s² (slowly!)
  - If you set magnitude to 20 and press "G", balls will fall with 20 m/s² (very fast!)
- Examples:
  - 0 = No gravity (Direction preset will show as ZERO)
  - 0.1 = Very weak gravity (1% of Earth)
  - 1.62 = Moon gravity
  - 9.81 = Earth gravity
  - 20 = ~2× Earth gravity

**Note about Direction preset at low magnitudes:**
- When magnitude is very low (e.g., 0.1), the acceleration vector is very small
- The system may display Direction as "ZERO" because the vector is close to (0,0,0)
- However, the magnitude value is still stored and will be used when you press "G"

**How it works:**
```
Acceleration = Direction × Magnitude

Example (Gravity DOWN, Magnitude 19.62):
→ Acceleration = (0, -1, 0) × 19.62 = (0, -19.62, 0) m/s²
→ Balls fall twice as fast as on Earth!
```

---

## Elasticity

There are **TWO different** elasticity parameters in the system:

### 1. Ball Elasticity (per ball)
**Location:** Model Section → Balls → Elasticity

**Range:** 0 - 100% (displayed as 0.00 - 1.00)  
**Default:** 90% (0.90)

**Effect:**
- Sets elasticity **for newly generated balls**
- Only applied when clicking **"Apply"** button
- Each ball gets this value as its personal `ball.elasticity`
- **Does NOT affect existing balls**

**Use case:** Configure how bouncy new balls should be

---

### 2. Global Elasticity
**Location:** Model Section → Physics → Global Elasticity

**Range:** 0 - 100% (displayed as 0.00 - 1.00)  
**Default:** 90% (0.90)

**Effect:**
- Applies to **ALL collisions** (ball-ball AND ball-wall)
- Works **immediately** (live effect)
- Affects **all existing balls** in real-time
- Multiplied with ball elasticity in collision calculations

**Use case:** Change bounciness of entire simulation in real-time

---

## How Elasticity Works in Collisions

### Formula:
```
Effective Elasticity = Ball1.elasticity × Ball2.elasticity × Global.elasticity

For ball-wall collision:
Effective Elasticity = Ball.elasticity × Global.elasticity
```

### Examples:

**Scenario 1: Default settings**
- Ball Elasticity: 0.90
- Global Elasticity: 0.90
- Result: 0.90 × 0.90 = **0.81** (balls bounce back to 81% of velocity)

**Scenario 2: Super bouncy**
- Ball Elasticity: 1.00 (set before "Apply")
- Global Elasticity: 1.00 (slide to 100%)
- Result: 1.00 × 1.00 = **1.00** (perfectly elastic, no energy loss)

**Scenario 3: Dead bounce (live adjustment)**
- Ball Elasticity: 0.90 (existing balls)
- Global Elasticity: 0.00 (slide to 0%)
- Result: 0.90 × 0.00 = **0.00** (balls don't bounce at all)
  - **This works immediately without regenerating balls!**

**Scenario 4: Damping**
- Ball Elasticity: 0.90 (existing balls)
- Global Elasticity: 0.50 (slide to 50%)
- Result: 0.90 × 0.50 = **0.45** (balls lose energy quickly)

---

## Quick Reference Table

| Parameter | When Applied | Scope | Live Effect |
|-----------|-------------|-------|-------------|
| **Gravity Direction** | Immediately | All balls | ✅ Yes |
| **Gravity Magnitude** | Immediately | All balls | ✅ Yes |
| **Ball Elasticity** | On "Apply" | New balls only | ❌ No |
| **Global Elasticity** | Immediately | All collisions | ✅ Yes |

---

## Typical Workflow

### Setting up a new simulation:
1. Configure **Ball Elasticity** (e.g., 0.95 for bouncy balls)
2. Click **"Apply"** → Generates balls with this elasticity
3. Adjust **Gravity Direction** and **Magnitude** as desired
4. Fine-tune **Global Elasticity** in real-time while watching

### Experimenting with existing simulation:
1. **DON'T** click "Apply" (keeps existing balls)
2. Change **Gravity Direction** → See balls fall in different directions
3. Change **Gravity Magnitude** → See balls accelerate faster/slower
4. Change **Global Elasticity** → See balls bounce more/less

---

## Tips

### 🎯 Want super bouncy balls?
- Set **Ball Elasticity** to 100%
- Click **"Apply"**
- Set **Global Elasticity** to 100%
- Result: Nearly no energy loss!

### 🎯 Want to see slow-motion?
- Set **Gravity Magnitude** to 1.0 (Moon-like)
- Set **Global Elasticity** to 95% (minimal energy loss)
- Result: Balls float gracefully!

### 🎯 Want to dampen existing simulation?
- **DON'T** click "Apply"
- Just slide **Global Elasticity** down to 50%
- Result: Existing balls calm down immediately!

### 🎯 Want to test different gravity without changing direction?
- Keep **Gravity Direction** on "Down"
- Slide **Gravity Magnitude** between 0 and 20
- Result: Same direction, different strength!

---

## Physics Background

**Elasticity** in physics describes how much kinetic energy is preserved in a collision:
- **e = 1.0** (perfectly elastic): All kinetic energy preserved
- **e = 0.0** (perfectly inelastic): All kinetic energy lost (objects stick)
- **0 < e < 1** (real world): Some energy lost to heat, sound, deformation

Our simulation uses the **coefficient of restitution**:
```
Relative velocity after collision = -e × (Relative velocity before collision)
```

This is why multiplying elasticities makes sense:
- Each surface contributes to energy loss
- Ball 1 might be rubber (e=0.9), Ball 2 might be steel (e=0.95)
- Combined: 0.9 × 0.95 = 0.855

---

**Last updated:** February 23, 2026

