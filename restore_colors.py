import re

def replace_colors():
    with open('desktop/src/views/BookDetailView.tsx', 'r') as f:
        content = f.read()

    # Backgrounds
    content = content.replace('bg-zinc-950', 'bg-surface')
    content = content.replace('bg-zinc-900/30', 'bg-surface-container-lowest')
    content = content.replace('bg-zinc-900/50', 'bg-surface-container-low')
    content = content.replace('bg-zinc-900', 'bg-surface-container-lowest')
    content = content.replace('bg-zinc-800/50', 'bg-surface-container')
    content = content.replace('bg-zinc-800/30', 'border-outline-variant/30')
    content = content.replace('bg-zinc-800', 'bg-surface-container')
    content = content.replace('bg-zinc-700', 'bg-surface-container-high')

    # Borders
    content = content.replace('border-zinc-800/30', 'border-outline-variant/30')
    content = content.replace('border-zinc-800', 'border-outline-variant')
    content = content.replace('border-zinc-700', 'border-outline-variant')
    content = content.replace('border-zinc-600', 'border-outline')

    # Texts
    content = content.replace('text-zinc-200', 'text-primary')
    content = content.replace('text-zinc-300', 'text-primary')
    content = content.replace('text-zinc-400', 'text-on-surface')
    content = content.replace('text-zinc-500', 'text-on-surface-variant')
    content = content.replace('text-zinc-600', 'text-on-surface-variant')
    content = content.replace('placeholder:text-zinc-600', 'placeholder:text-on-surface-variant')

    # Emerald (Accent)
    content = content.replace('text-emerald-500/70', 'text-accent-blue font-medium')
    content = content.replace('text-emerald-500', 'text-accent-blue')
    content = content.replace('text-emerald-400', 'text-accent-blue')
    content = content.replace('text-emerald-300', 'text-accent-blue/80')
    content = content.replace('bg-emerald-500/50', 'bg-accent-blue/50')
    content = content.replace('bg-emerald-500/10', 'bg-active-bg')
    content = content.replace('bg-emerald-500', 'bg-accent-blue')
    content = content.replace('border-emerald-500', 'border-accent-blue')
    content = content.replace('border-l-emerald-500', 'border-l-accent-blue')
    content = content.replace('ring-emerald-500/50', 'ring-accent-blue/50')
    content = content.replace('shadow-[0_0_8px_rgba(16,185,129,0.5)]', '')

    with open('desktop/src/views/BookDetailView.tsx', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    replace_colors()
