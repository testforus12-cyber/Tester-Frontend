// src/features/add-vendor/utils/validators.ts
export const isControlKey = (e: React.KeyboardEvent<HTMLInputElement>) =>
  e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' ||
  e.key === 'Escape' || e.key === 'Enter' || e.key === 'Home' ||
  e.key === 'End' || e.key.startsWith('Arrow') || e.ctrlKey || e.metaKey;

export const isTwoDp = (s: string) => /^(\d+(\.\d{0,2})?)?$/.test(s);

type KeydownOpts = {
  allowDecimal?: boolean;
  max?: number;          // inclusive
  min?: number;          // inclusive
  decimals?: number;     // default 2
};

export const handleNumericKeyDown =
  (opts: KeydownOpts = {}) =>
  (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isControlKey(e)) return;

    const { allowDecimal = false, max = Number.POSITIVE_INFINITY, min = 0, decimals = 2 } = opts;
    const ch = e.key;

    if (allowDecimal) {
      if (!/^[0-9.]$/.test(ch)) return void e.preventDefault();
      const cur = (e.currentTarget as HTMLInputElement).value;
      if (ch === '.' && cur.includes('.')) return void e.preventDefault();
      const next = cur + ch;
      if (!new RegExp(`^(\\d+(\\.\\d{0,${decimals}})?)?$`).test(next)) return void e.preventDefault();

      const num = parseFloat(next);
      if (!Number.isNaN(num) && (num > max || num < min)) return void e.preventDefault();
    } else {
      if (!/^[0-9]$/.test(ch)) return void e.preventDefault();
      const cur = (e.currentTarget as HTMLInputElement).value;
      const next = cur + ch;
      const num = parseInt(next, 10);
      if (!Number.isNaN(num) && (num > max || num < min)) return void e.preventDefault();
    }
  };
export const numericKeydown = (max?: number, allowDecimal = false) =>
  (e: React.KeyboardEvent<HTMLInputElement>) => {
    const ctrl = ['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','Home','End'];
    if (ctrl.includes(e.key) || e.ctrlKey || e.metaKey) return;

    const isDigit = /^[0-9]$/.test(e.key);
    const isDot = e.key === '.';
    if (!isDigit && !(allowDecimal && isDot)) { e.preventDefault(); return; }

    const next = (e.currentTarget.value || '') + e.key;

    if (allowDecimal && (next.match(/\./g)?.length ?? 0) > 1) { e.preventDefault(); return; }

    if (max != null) {
      const n = parseFloat(next);
      if (!Number.isNaN(n) && n > max) e.preventDefault();
    }
  };
