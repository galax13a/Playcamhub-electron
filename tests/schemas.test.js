import { describe, it, expect } from 'vitest';

// Schema modules are CommonJS — Vite exposes module.exports as the default import.
import auth from '../src/backend/schemas/auth.js';
import songs from '../src/backend/schemas/songs.js';
import contacts from '../plugins/contacts/backend/schemas/contacts.js';

const { LoginSchema, RegisterSchema, ProfileUpdateSchema } = auth;
const { IdParamsSchema, SongQuerySchema, SongUpdateSchema } = songs;
const { ContactCreateSchema, ContactQuerySchema } = contacts;

describe('auth schemas', () => {
  it('accepts a valid login and trims the username', () => {
    const parsed = LoginSchema.parse({ username: '  ada  ', password: 'secret' });
    expect(parsed.username).toBe('ada');
    expect(parsed.password).toBe('secret');
  });

  it('rejects an empty username', () => {
    expect(() => LoginSchema.parse({ username: '', password: 'x' })).toThrow();
  });

  it('enforces minimum password length on register', () => {
    expect(() =>
      RegisterSchema.parse({ username: 'ada', password: '123' })
    ).toThrow();
    expect(() =>
      RegisterSchema.parse({ username: 'ada', password: '123456' })
    ).not.toThrow();
  });

  it('applies defaults for optional profile fields', () => {
    const parsed = ProfileUpdateSchema.parse({ username: 'ada' });
    expect(parsed.full_name).toBe('');
    expect(parsed.nickname).toBe('');
    expect(parsed.whatsapp).toBeNull();
  });
});

describe('song schemas', () => {
  it('coerces and validates numeric id params', () => {
    expect(IdParamsSchema.parse({ id: '42' }).id).toBe(42);
    expect(() => IdParamsSchema.parse({ id: '-1' })).toThrow();
    expect(() => IdParamsSchema.parse({ id: 'abc' })).toThrow();
  });

  it('applies query defaults and coerces types', () => {
    const parsed = SongQuerySchema.parse({});
    expect(parsed.limit).toBe(200);
    expect(parsed.offset).toBe(0);

    const withFav = SongQuerySchema.parse({ favorite: 'true', type: 'audio' });
    expect(withFav.favorite).toBe(true);
    expect(withFav.type).toBe('audio');
  });

  it('rejects an invalid media type', () => {
    expect(() => SongQuerySchema.parse({ type: 'pdf' })).toThrow();
  });

  it('allows a partial song update', () => {
    expect(() => SongUpdateSchema.parse({ title: 'New title' })).not.toThrow();
    expect(() => SongUpdateSchema.parse({ title: '' })).toThrow();
  });
});

describe('contact schemas', () => {
  it('requires a name and validates email format', () => {
    expect(() => ContactCreateSchema.parse({})).toThrow();
    expect(() =>
      ContactCreateSchema.parse({ name: 'Bob', email: 'not-an-email' })
    ).toThrow();
    const ok = ContactCreateSchema.parse({ name: 'Bob', email: 'bob@x.com' });
    expect(ok.name).toBe('Bob');
    expect(ok.active).toBe(true);
  });

  it('applies pagination defaults and bounds', () => {
    const parsed = ContactQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.per_page).toBe(25);
    expect(() => ContactQuerySchema.parse({ per_page: '500' })).toThrow();
  });
});
