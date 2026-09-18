import type { PortraitFn } from './portrait.ts';
import { pokemonImage, typeIconUrl } from './art.ts';

/**
 * Login, account creation, trainer setup and starter choice.
 *
 * Everything here is local. There is no server yet, so no password is ever
 * stored — the field exists so the flow is real and so wiring it to the
 * gateway later is a matter of replacing one function, not redesigning the
 * screens. Storing a password in localStorage would be security theatre and
 * worse than storing nothing.
 */

const ACCOUNT_KEY = 'pokeidle.account.v1';

export type SpeciesLike = {
  slug: string;
  name: string;
  variant: string;
  look: number;
  types: string[];
  hp: number;
  level: number;
};

export type Account = {
  email: string;
  trainer: { name: string; outfit: number };
  starter: { slug: string; name: string; look: number };
  createdAt: number;
};

/** The nine starters, by generation. Slugs match the species registry. */
export const STARTERS: Array<{ gen: string; region: string; slugs: [string, string, string] }> = [
  { gen: 'Geração I', region: 'Kanto', slugs: ['bulbasaur', 'charmander', 'squirtle'] },
  { gen: 'Geração II', region: 'Johto', slugs: ['chikorita', 'cyndaquil', 'totodile'] },
  { gen: 'Geração III', region: 'Hoenn', slugs: ['treecko', 'torchic', 'mudkip'] },
];

/**
 * The two trainer outfits, taken from the server's own outfits.xml — the
 * entries named "Trainer", type 1 (male) and type 0 (female). They are the
 * pose the reference game shows in its profile panel. The ids that were here
 * before, 510 and 511, are Pokémon in this sprite pack, not people.
 */
export const OUTFITS = [
  { id: 1112, label: 'Treinador' },
  { id: 1113, label: 'Treinadora' },
];

export function readAccount(): Account | null {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null') as Account | null;
    return raw?.trainer?.name ? raw : null;
  } catch {
    return null;
  }
}

export function clearAccount(): void {
  try {
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* storage may be unavailable */
  }
}

function saveAccount(account: Account): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    /* the session still works, it just will not be remembered */
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Resolve to the signed-in account, showing the onboarding screens when there
 * is not one yet. The caller awaits this before building the world.
 */
export function ensureAccount(species: SpeciesLike[], portrait: PortraitFn): Promise<Account> {
  const existing = readAccount();
  if (existing) return Promise.resolve(existing);

  const gate = $('gate');
  gate.hidden = false;

  const draft = {
    email: '',
    name: '',
    outfit: OUTFITS[0]!.id,
    starter: null as SpeciesLike | null,
  };

  const steps = ['login', 'signup', 'trainer', 'starter'] as const;
  type Step = (typeof steps)[number];

  const show = (step: Step) => {
    for (const s of steps) $(`step-${s}`).hidden = s !== step;
    $('gate-err').textContent = '';
  };

  const fail = (message: string) => {
    $('gate-err').textContent = message;
  };

  return new Promise<Account>((resolve) => {
    // ── login ────────────────────────────────────────────────────────────────
    $('go-signup').addEventListener('click', () => {
      show('signup');
    });

    $('do-login').addEventListener('click', () => {
      const email = $<HTMLInputElement>('li-email').value.trim();
      if (!email.includes('@')) return fail('Informe um e-mail válido.');
      if (!$<HTMLInputElement>('li-pass').value) return fail('Informe sua senha.');
      // Without a server there is nothing to authenticate against, so an
      // unknown e-mail continues into account creation rather than pretending
      // to reject a password it cannot check.
      draft.email = email;
      show('trainer');
    });

    // ── signup ───────────────────────────────────────────────────────────────
    $('back-login').addEventListener('click', () => show('login'));

    $('do-signup').addEventListener('click', () => {
      const email = $<HTMLInputElement>('su-email').value.trim();
      const pass = $<HTMLInputElement>('su-pass').value;
      const again = $<HTMLInputElement>('su-pass2').value;

      if (!email.includes('@')) return fail('Informe um e-mail válido.');
      if (pass.length < 8) return fail('A senha precisa de pelo menos 8 caracteres.');
      if (pass !== again) return fail('As senhas não conferem.');

      draft.email = email;
      show('trainer');
    });

    // ── trainer ──────────────────────────────────────────────────────────────
    const outfitRow = $('outfit-row');
    const paintOutfits = () => {
      outfitRow.replaceChildren();
      for (const outfit of OUTFITS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = outfit.id === draft.outfit ? 'pick on' : 'pick';
        btn.append(portrait(outfit.id, 64));
        const label = document.createElement('span');
        label.textContent = outfit.label;
        btn.append(label);
        btn.onclick = () => {
          draft.outfit = outfit.id;
          paintOutfits();
        };
        outfitRow.append(btn);
      }
    };
    paintOutfits();

    $('back-signup').addEventListener('click', () => show('login'));

    $('do-trainer').addEventListener('click', () => {
      const name = $<HTMLInputElement>('tr-name').value.trim();
      if (name.length < 3) return fail('O nome precisa de pelo menos 3 caracteres.');
      if (name.length > 20) return fail('O nome pode ter no máximo 20 caracteres.');
      if (!/^[\p{L}\p{N} ]+$/u.test(name)) return fail('Use apenas letras, números e espaços.');

      draft.name = name;
      paintStarters();
      show('starter');
    });

    // ── starter ──────────────────────────────────────────────────────────────
    const byName = new Map(species.filter((s) => s.variant === 'base').map((s) => [s.slug, s]));
    const gensRoot = $('gens');

    const paintStarters = () => {
      gensRoot.replaceChildren();

      for (const group of STARTERS) {
        const rows = group.slugs.map((slug) => byName.get(slug)).filter(Boolean) as SpeciesLike[];
        if (rows.length === 0) continue;

        const section = document.createElement('div');
        section.className = 'gen';
        const head = document.createElement('div');
        head.className = 'gen-head';
        head.innerHTML = `<span class="gen-name">${group.gen}</span><span class="gen-region">${group.region}</span>`;
        section.append(head);

        const row = document.createElement('div');
        row.className = 'gen-row';
        for (const sp of rows) {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = draft.starter?.slug === sp.slug ? 'starter on' : 'starter';
          // Artwork by name, the way the base client's own starter screen
          // does it — `getPokemonImage(pokemon.name)` in pokeinicial.lua.
          card.append(pokemonImage(sp.name, 'artwork', 96));

          const nm = document.createElement('span');
          nm.className = 'st-name';
          nm.textContent = sp.name;

          const tp = document.createElement('span');
          tp.className = 'st-type';
          for (const type of sp.types) {
            const icon = document.createElement('img');
            icon.src = typeIconUrl(type);
            icon.alt = type;
            icon.className = 'type-icon';
            tp.append(icon);
          }
          card.append(nm, tp);

          card.onclick = () => {
            draft.starter = sp;
            paintStarters();
          };
          row.append(card);
        }
        section.append(row);
        gensRoot.append(section);
      }
    };

    $('back-trainer').addEventListener('click', () => show('trainer'));

    $('do-start').addEventListener('click', () => {
      if (!draft.starter) return fail('Escolha um pokémon inicial.');

      const account: Account = {
        email: draft.email,
        trainer: { name: draft.name, outfit: draft.outfit },
        starter: {
          slug: draft.starter.slug,
          name: draft.starter.name,
          look: draft.starter.look,
        },
        createdAt: Date.now(),
      };

      saveAccount(account);
      gate.hidden = true;
      resolve(account);
    });

    show('login');
  });
}
