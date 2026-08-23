import { supabase } from '../lib/supabase.js';
import { getPopupAdminCatalog, savePopupDocument } from '../../shared/popup/popupService.js';

export const loadPopupAdminCatalog = () => getPopupAdminCatalog(supabase);
export const managePopupDocument = (documentValue) => savePopupDocument(supabase, documentValue);

