-- No source-controlled scripts, paths, or remote resources are executed.
local table_number = 0
function Table(el)
  table_number = table_number + 1
  if #el.caption.long == 0 then
    el.caption.long = {pandoc.Plain({pandoc.Str('Tabel'), pandoc.Space(), pandoc.Str(tostring(table_number))})}
  end
  return el
end
