import { User } from '@supabase/supabase-js';
import { Request } from 'express';

export type AuthenticatedRequest = Request & {
  authToken?: string;
  authUser?: User;
};
