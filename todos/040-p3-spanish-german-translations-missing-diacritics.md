# P3: Spanish and German translations are missing diacritical marks

## Location
- `apps/mobile/src/i18n/locales/es.json`
- `apps/mobile/src/i18n/locales/de.json`

## Problem
Multiple Spanish and German translations are missing required diacritical marks (accents, umlauts):

**Spanish (es.json):**
- "Iniciar Sesion" -> "Iniciar Sesion" (should be "Sesion" with accent: "Sesion" -- actually "Sesion" should be "Sesi\u00f3n")
- "Cerrar Sesion" -> should be "Sesi\u00f3n"
- "Correo electronico" -> should be "electr\u00f3nico"
- "Contrasena" -> should be "Contrase\u00f1a"
- "Registrate" -> should be "Reg\u00edstrate"
- "Diagnosticar" / "Diagnostico" -> should have accent on "o": "Diagn\u00f3stico"
- "Articulo" -> should be "Art\u00edculo"
- "Pagina" -> should be "P\u00e1gina"
- "Ano" (year) -> should be "A\u00f1o" (without the tilde, "ano" means "anus" in Spanish)

**German (de.json):**
- "Loschen" -> should be "L\u00f6schen"
- "Zuruck" -> should be "Zur\u00fcck"
- "Vollstandiger" -> should be "Vollst\u00e4ndiger"
- "Wahle" -> should be "W\u00e4hle"
- "hinzufugen" -> should be "hinzuf\u00fcgen"

The es.json "Ano" issue is particularly notable as it changes the meaning of the word entirely.

## Fix
Review all translations with a native speaker or use proper Unicode characters throughout both locale files.
