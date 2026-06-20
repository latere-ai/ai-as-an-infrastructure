-- Pandoc filter: drop the soft line break between two CJK characters.
--
-- The Chinese source wraps paragraphs at ~100 columns, so pandoc sees a
-- newline mid-paragraph and renders it as a visible space between Chinese
-- characters (保持 可负担). The `east_asian_line_breaks` reader extension is
-- meant to fix this but is not honored through Quarto's pipeline, so we do it
-- on the AST instead: a SoftBreak whose neighbours are both CJK is removed;
-- every other SoftBreak keeps its normal single space (Latin words, a code
-- span next to text, etc.).

local stringify = pandoc.utils.stringify

local function last_codepoint(s)
  if not s or #s == 0 then return nil end
  local i = utf8.offset(s, -1)
  if not i then return nil end
  return utf8.codepoint(s, i)
end

local function first_codepoint(s)
  if not s or #s == 0 then return nil end
  return utf8.codepoint(s, 1)
end

local function is_cjk(cp)
  if not cp then return false end
  return (cp >= 0x2E80  and cp <= 0x9FFF)   -- radicals, kana, CJK unified, ext A
      or (cp >= 0xF900  and cp <= 0xFAFF)   -- CJK compatibility ideographs
      or (cp >= 0xFF00  and cp <= 0xFFEF)   -- fullwidth forms and punctuation
      or (cp >= 0x20000 and cp <= 0x2FA1F)  -- CJK ext B+ and compat supplement
end

function Inlines(inlines)
  local out = {}
  for i = 1, #inlines do
    local el = inlines[i]
    if el.t == 'SoftBreak' then
      local prev = inlines[i - 1]
      local nxt  = inlines[i + 1]
      local prev_cjk = prev and is_cjk(last_codepoint(stringify(prev)))
      local next_cjk = nxt  and is_cjk(first_codepoint(stringify(nxt)))
      if not (prev_cjk and next_cjk) then
        table.insert(out, pandoc.Space())
      end
      -- both CJK: drop the break, leaving no space
    else
      table.insert(out, el)
    end
  end
  return out
end
