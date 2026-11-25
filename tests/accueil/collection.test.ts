import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Artwork } from '@/db/database';
import {
  buildSommaire,
  centuryLabel,
  centuryOf,
  monthLabel,
  parseYear,
  pickCover,
} from '@/utils/collection';

let nextId = 1;
function oeuvre(champs: Partial<Artwork>): Artwork {
  return {
    id: nextId++,
    title: 'Titre',
    artist: 'Artiste',
    description: 'Une description.',
    year: '1900',
    style: '',
    imageUri: 'file:///image.jpg',
    ...champs,
  };
}

test('date de la une en capitales, en français', () => {
  assert.equal(monthLabel(new Date(2026, 10, 25)), 'NOVEMBRE 2026');
  assert.equal(monthLabel(new Date(2027, 7, 1)), 'AOÛT 2027');
});

test('la une : même œuvre toute la journée, une autre le lendemain', () => {
  const oeuvres = [oeuvre({}), oeuvre({}), oeuvre({})];
  const matin = pickCover(oeuvres, new Date(2026, 10, 25, 8, 0));
  const soir = pickCover(oeuvres, new Date(2026, 10, 25, 23, 30));
  const lendemain = pickCover(oeuvres, new Date(2026, 10, 26, 8, 0));
  assert.equal(matin?.id, soir?.id);
  assert.notEqual(matin?.id, lendemain?.id);
});

test('la une préfère les œuvres avec image', () => {
  const sansImage = oeuvre({ imageUri: null });
  const avecImage = oeuvre({});
  for (let jour = 1; jour <= 5; jour += 1) {
    assert.equal(pickCover([sansImage, avecImage], new Date(2026, 0, jour))?.id, avecImage.id);
  }
  assert.equal(pickCover([sansImage], new Date(2026, 0, 1))?.id, sansImage.id);
  assert.equal(pickCover([], new Date(2026, 0, 1)), null);
});

test('lecture des années et des siècles', () => {
  assert.equal(parseYear('vers 1813'), 1813);
  assert.equal(parseYear('450 av. J.-C.'), -450);
  assert.equal(parseYear(''), null);
  assert.equal(centuryOf('1813'), 19);
  assert.equal(centuryOf('1900'), 19);
  assert.equal(centuryOf('1901'), 20);
  assert.equal(centuryOf('XIIe siècle'), 12);
  assert.equal(centuryOf('Ier siècle'), 1);
  assert.equal(centuryOf('450 av. J.-C.'), -5);
  assert.equal(centuryOf('inconnue'), null);
  assert.equal(centuryLabel(19), 'XIXe siècle');
  assert.equal(centuryLabel(1), 'Ier siècle');
  assert.equal(centuryLabel(-5), 'Ve siècle av. J.-C.');
});

test('sommaire : artiste, siècle, puis fiche à compléter', () => {
  const sommaire = buildSommaire([
    oeuvre({ title: 'Le Départ du fils prodigue', artist: 'Christoffer Wilhelm Eckersberg', year: '1813' }),
    oeuvre({ title: "L'escalier de l'Ara Coeli", artist: 'Christoffer Wilhelm Eckersberg', year: '1814' }),
    oeuvre({ title: 'Les Nymphéas', artist: 'Claude Monet', year: '1899' }),
    oeuvre({ title: 'Le cloître de Saint-Paul', artist: 'Pietro Vassalletto', year: '1220' }),
    oeuvre({ title: 'Œuvre inconnue', artist: '', year: '', description: '' }),
  ]);
  assert.deepEqual(sommaire.map((e) => e.key), ['artiste', 'siecle', 'a-completer']);
  assert.equal(sommaire[0].title, 'Christoffer Wilhelm Eckersberg');
  assert.equal(sommaire[0].subtitle, "Le Départ du fils prodigue et L'escalier de l'Ara Coeli");
  assert.equal(sommaire[1].title, 'Le XIXe siècle');
  assert.equal(sommaire[1].subtitle, '3 œuvres de 2 artistes, de 1813 à 1899');
  assert.equal(sommaire[2].title, 'Une œuvre encore sans nom');
  assert.equal(sommaire[2].subtitle, "À compléter : le titre, l'artiste, l'année et la description");
  assert.equal(sommaire[2].target, 'edit');
});

test("le siècle n'est pas répété s'il ne contient que l'artiste déjà cité", () => {
  const sommaire = buildSommaire([
    oeuvre({ artist: 'Eckersberg', year: '1813' }),
    oeuvre({ artist: 'Eckersberg', year: '1814' }),
    oeuvre({ artist: 'Monet', year: '1920' }),
  ]);
  assert.deepEqual(sommaire.map((e) => e.key), ['artiste']);
});

test('sommaire vide pour une collection complète sans regroupement', () => {
  assert.deepEqual(buildSommaire([oeuvre({ artist: 'A', year: '1500' }), oeuvre({ artist: 'B', year: '1700' })]), []);
});

test('plusieurs fiches à compléter : la plus récente, avec le nombre', () => {
  const ancienne = oeuvre({ title: 'Ancienne', artist: 'A', year: '' });
  const recente = oeuvre({ title: 'Récente', artist: 'B', description: '' });
  const [entree] = buildSommaire([ancienne, recente]);
  assert.equal(entree.artworkId, recente.id);
  assert.equal(entree.subtitle, 'À compléter : la description · 2 fiches à compléter');
});
