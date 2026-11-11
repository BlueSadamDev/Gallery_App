import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  EnvironmentData,
  FALLBACK_ENVIRONMENT,
  loadEnvironment,
} from '@/services/galleryEnvironment';
import { getMoment, minutesOfDay, Moment, Weather, weatherFromCode } from '@/utils/ambiance';

export type GalleryEnvironment = {
  moment: Moment;
  weather: Weather;
  // Informations complémentaires (heure courante, soleil) utiles à l'écran.
  now: Date;
  sunriseMin: number | null;
  sunsetMin: number | null;
};

// Fournit l'état réel de la galerie : moment de la journée et météo.
// - Charge la météo quand l'écran devient visible (cache de 30 min dans le service).
// - Recalcule le moment chaque minute tant que l'écran est visible.
export function useGalleryEnvironment(): GalleryEnvironment {
  const [data, setData] = useState<EnvironmentData>(FALLBACK_ENVIRONMENT);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setNow(new Date());
      loadEnvironment().then((result) => {
        if (active) setData(result);
      });
      const timer = setInterval(() => setNow(new Date()), 60 * 1000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );

  return {
    moment: getMoment(minutesOfDay(now), data.sunriseMin, data.sunsetMin),
    weather: weatherFromCode(data.weatherCode),
    now,
    sunriseMin: data.sunriseMin,
    sunsetMin: data.sunsetMin,
  };
}
