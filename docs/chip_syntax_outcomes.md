# Basket Chip Syntax & Tooltip Outcomes

Every entry a user can put in the basket evaluates to a chip. This document
lists each syntax shape the parser accepts, what the chip becomes, and exactly
what its tooltip shows. All examples below were produced by running the real
renderer (`PresetBasket.render`) against the cache in the "Reference" section.

---

## 1. Reference cache

| Key              | Preset body                      |
| :--------------- | :------------------------------- |
| `faces/portrait` | `portrait, solo`                 |
| `faces/macro`    | `macro`                          |
| `hair/blonde`    | `blonde hair`                    |
| `hair/dark`      | `dark hair`                      |
| `outfit/armor`   | `plate armor made of {material}` |
| `outfit/robe`    | `silk robe`                      |
| `look/simple`    | `simple look`                    |
| `look/combo`     | `look/simple, extra`             |
| `material/gold`  | `gold`                           |

---

## 2. Tooltip anatomy

A tooltip is built in two layers:

```
[evaluated value]        <- prepended only when it adds information
<blank>
<Name> [<key>]          <- header: preset name and resolved cache key
<preset body>           <- the raw text stored in the preset
<blank>
Rolled Variants:        <- appended only when the chip rolled
🎲 <Group>: <Variant>
```

The **evaluated value** is what the chip actually contributes to the prompt after
expansion. The **header** names the preset it came from. When the evaluated value
is already the header's body, it is not repeated - that would be noise. When it
is not, it is prepended, because that is the half the user cannot otherwise see.

---

## 3. Syntax shapes

### 3.1 Direct preset key

| Chip             | Evaluates to     | Tooltip                                     |
| :--------------- | :--------------- | :------------------------------------------ |
| `faces/portrait` | `portrait, solo` | `Portrait [faces/portrait]\nportrait, solo` |

The evaluated value equals the preset body, so only the header is shown.

### 3.2 Preset body typed literally

| Chip             | Evaluates to     | Tooltip                                     |
| :--------------- | :--------------- | :------------------------------------------ |
| `portrait, solo` | `portrait, solo` | `Portrait [faces/portrait]\nportrait, solo` |

The literal text matches a preset body, so the chip resolves to that preset and
shows its header. This is how pasted prompts get recognised.

### 3.3 Weighted preset

| Chip                   | Evaluates to           | Tooltip                                                             |
| :--------------------- | :--------------------- | :------------------------------------------------------------------ |
| `(faces/portrait:1.5)` | `(portrait, solo:1.5)` | `(portrait, solo:1.5)\n\nPortrait [faces/portrait]\nportrait, solo` |
| `(faces/portrait:1)`   | `(portrait, solo:1)`   | `(portrait, solo:1)\n\nPortrait [faces/portrait]\nportrait, solo`   |

The weight is part of the evaluated value, so the weighted form is prepended.
A weight of `1` is still shown, because the chip as written differs from the
preset body.

### 3.4 Random group roll

| Chip     | Evaluates to                   | Tooltip                                                                                 |
| :------- | :----------------------------- | :-------------------------------------------------------------------------------------- |
| `{hair}` | `blonde hair` (or `dark hair`) | `blonde hair\n\nBlonde [hair/blonde]\nblonde hair\n\nRolled Variants:\n🎲 Hair: blonde` |

A bare group picks a random member. The header names the preset that was rolled,
and the roll section records which one was chosen. The evaluated value is
prepended because it is the only place the outcome is visible.

### 3.5 Explicit variant selection

| Chip            | Evaluates to  | Tooltip                             |
| :-------------- | :------------ | :---------------------------------- |
| `{hair:blonde}` | `blonde hair` | `Blonde [hair/blonde]\nblonde hair` |

The variant resolves straight to a preset, so the header is enough. No roll
section is added - nothing was rolled.

### 3.6 Virtual null (omission)

| Chip          | Evaluates to | Tooltip       |
| :------------ | :----------- | :------------ |
| `{hair:none}` | _(empty)_    | `{hair:none}` |
| `{hair:null}` | _(empty)_    | `{hair:null}` |

The chip is omitted from the prompt entirely. The tooltip falls back to the raw
chip text rather than showing a blank.

### 3.7 Child variable injection

| Chip                            | Evaluates to               | Tooltip                                                                            |
| :------------------------------ | :------------------------- | :--------------------------------------------------------------------------------- |
| `{outfit:armor{material:gold}}` | `plate armor made of gold` | `plate armor made of gold\n\nArmor [outfit/armor]\nplate armor made of {material}` |

The child placeholder is injected into the preset before expansion. The header
shows the preset's own body (with its placeholder intact), so the evaluated value
is prepended.

### 3.8 Tag (LoRA / hypernetwork)

| Chip                     | Evaluates to             | Tooltip                  |
| :----------------------- | :----------------------- | :----------------------- |
| `<lora:anime_style:0.8>` | `<lora:anime_style:0.8>` | `<lora:anime_style:0.8>` |

A tag matches no preset, so there is no header. The evaluated value is the whole
tooltip.

### 3.9 Weighted tag

| Chip                           | Evaluates to                   | Tooltip                        |
| :----------------------------- | :----------------------------- | :----------------------------- |
| `(<lora:anime_style:0.8>:1.5)` | `(<lora:anime_style:0.8>:1.5)` | `(<lora:anime_style:0.8>:1.5)` |

Same as a plain tag, with the weight preserved in the tooltip.

### 3.10 Preset that expands past its own body

| Chip         | Evaluates to         | Tooltip                                                        |
| :----------- | :------------------- | :------------------------------------------------------------- |
| `look/combo` | `simple look, extra` | `simple look, extra\n\nCombo [look/combo]\nlook/simple, extra` |

The preset body references another preset, so expansion changes it. The evaluated
value is prepended and the header shows the original body.

### 3.11 Composite chip

| Chip                       | Evaluates to         | Tooltip                                    |
| :------------------------- | :------------------- | :----------------------------------------- |
| `look/simple, faces/macro` | `simple look, macro` | `simple look, macro\n\nsimple look, macro` |

Several presets joined into one chip. The evaluated value is prepended; there is
no single header because the chip names no one preset.

### 3.12 Key embedded in a weighted chip

| Chip                                  | Evaluates to                                         | Tooltip                                                                                                                                        |
| :------------------------------------ | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `({pose} {char} prop/furn/sofa:1.15)` | `(standing pose hero character sofa furniture:1.15)` | `(standing pose hero character sofa furniture:1.15)\n\n({pose} {char} prop/furn/sofa:1.15)\n\nRolled Variants:\n🎲 Pose: stand\n🎲 Char: hero` |

`(text:weight)` is one attention token, so the whole thing is a single chip. A
bare key written alongside the braces resolves too; the tooltip then shows the
evaluated value and the raw chip text as written, each once.

### 3.13 Unresolvable text

| Chip                | Evaluates to        | Tooltip             |
| :------------------ | :------------------ | :------------------ |
| `unresolvable text` | `unresolvable text` | `unresolvable text` |
| `{nogroup}`         | `{nogroup}`         | `{nogroup}`         |

Nothing matches, so the chip passes through untouched and the tooltip is the text
itself.

### 3.13 Library-qualified key

| Chip                                   | Evaluates to | Tooltip                            |
| :------------------------------------- | :----------- | :--------------------------------- |
| `socks#faces/macro` (owned by `socks`) | `macro`      | `Macro [socks#faces/macro]\nmacro` |

A key owned by another library carries its qualifier in the header, the way grid
items do. The qualifier applies to the resolved cache key only - never to a
weighted or wrapped chip text.

---

## 4. When is the evaluated value prepended?

The value is prepended when the header does not already show it:

| Situation                      | Prepended? | Why                                |
| :----------------------------- | :--------- | :--------------------------------- |
| Key whose body is the value    | No         | Header already shows it            |
| Literal preset body            | No         | Resolves to that preset's header   |
| Weighted form                  | Yes        | Weight is not in the body          |
| Random roll                    | Yes        | Roll outcome is not in the body    |
| Child injection                | Yes        | Injected text is not in the body   |
| Preset expanding past its body | Yes        | Expanded text is not the body      |
| Tag / unresolvable text        | Yes        | No header exists at all            |
| Virtual null                   | n/a        | Tooltip falls back to the raw chip |

---

## 5. Related code

- `PresetLogic.withEvaluatedValue` - prepends the evaluated value when it adds
  information.
- `PresetLogic.parseBasketChip` - builds the header and chooses the evaluated
  value for each shape.
- `PresetLogic.expandEmbeddedKeys` - resolves a bare key that is not the whole
  token, so `({pose} prop/furn/sofa:1.15)` expands its key.
- `PresetBasket.render` - puts `processed.tooltipTitle` on the chip element.
