import { useQuery } from '@tanstack/react-query';
import { getHome } from '../services/publicApi';

/** GET /home, shared by the home page sections (one request). */
export function useHomeData() {
  return useQuery({ queryKey: ['home'], queryFn: getHome, staleTime: 5 * 60 * 1000 });
}
