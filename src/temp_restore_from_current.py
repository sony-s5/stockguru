from pathlib import Path
import subprocess

current_path = Path('src/lib/screener.ts')
current_lines = current_path.read_text(encoding='utf-8').splitlines()

git_text = subprocess.check_output(
    ['git', 'show', 'HEAD:src/lib/screener.ts'], text=True, encoding='utf-8', errors='ignore'
)
git_lines = git_text.splitlines()

# Extract current normalizeLabel + parseScreenerHTML blocks from current file
normalize_start = next(i for i, l in enumerate(current_lines) if l.startswith('function normalizeLabel('))
parse_start = next(i for i, l in enumerate(current_lines) if l.startswith('function parseScreenerHTML('))

# Find end of parseScreenerHTML by brace counting
brace_count = 0
parse_end = None
for idx in range(parse_start, len(current_lines)):
    brace_count += current_lines[idx].count('{')
    brace_count -= current_lines[idx].count('}')
    if idx > parse_start and brace_count == 0:
        parse_end = idx
        break
if parse_end is None:
    raise RuntimeError('Could not locate end of parseScreenerHTML in current file')

new_normalize = current_lines[normalize_start:parse_start]
new_parse = current_lines[parse_start:parse_end + 1]

# Locate insertion points in git file
parse_original_start = next(i for i, l in enumerate(git_lines) if l.startswith('function parseScreenerHTML('))
merge_start = next(i for i, l in enumerate(git_lines) if l.strip().startswith('// 4. Merge'))

# Insert normalizeLabel after decodeEntities block
decode_start = next(i for i, l in enumerate(git_lines) if l.startswith('function decodeEntities('))
brace_count = 0
decode_end = None
for idx in range(decode_start, len(git_lines)):
    brace_count += git_lines[idx].count('{')
    brace_count -= git_lines[idx].count('}')
    if idx > decode_start and brace_count == 0:
        decode_end = idx
        break
if decode_end is None:
    raise RuntimeError('Could not locate end of decodeEntities in git file')

# Ensure we don't duplicate normalizeLabel if it exists in git file
existing_normalize = [i for i,l in enumerate(git_lines) if l.startswith('function normalizeLabel(')]
if existing_normalize:
    # remove old normalizeLabel block if present
    norm_start = existing_normalize[0]
    brace_count = 0
    norm_end = None
    for idx in range(norm_start, len(git_lines)):
        brace_count += git_lines[idx].count('{')
        brace_count -= git_lines[idx].count('}')
        if idx > norm_start and brace_count == 0:
            norm_end = idx
            break
    if norm_end is None:
        raise RuntimeError('Could not locate end of existing normalizeLabel')
    del git_lines[norm_start:norm_end+1]
    if norm_start < parse_original_start:
        parse_original_start -= (norm_end - norm_start + 1)
        merge_start -= (norm_end - norm_start + 1)
    if norm_start <= decode_end:
        decode_end -= (norm_end - norm_start + 1)

# Replace the parse function block in git lines
new_git_lines = git_lines[:parse_original_start] + new_parse + git_lines[merge_start:]

# Insert normalizeLabel after decodeEntities end
insert_index = decode_end + 1
new_git_lines = new_git_lines[:insert_index] + new_normalize + new_git_lines[insert_index:]

Path('src/lib/screener.ts').write_text('\n'.join(new_git_lines) + '\n', encoding='utf-8')
print('Rebuilt screener.ts with current parser and git rest of file')
