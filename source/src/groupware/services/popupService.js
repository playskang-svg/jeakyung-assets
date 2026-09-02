import { supabase } from '../lib/supabase.js';
import { deletePopupDocument, getPopupAdminCatalog, savePopupDocument } from '../../shared/popup/popupService.js';

export const loadPopupAdminCatalog = () => getPopupAdminCatalog(supabase);
export const managePopupDocument = (documentValue) => savePopupDocument(supabase, documentValue);
export const removePopupDocument = (id) => deletePopupDocument(supabase, id);

