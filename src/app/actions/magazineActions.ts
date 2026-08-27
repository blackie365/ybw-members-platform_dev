'use server';

import {
  getMagazineIssuesAction,
  updateMagazineIssueAction,
  createMagazineIssueAction,
  deleteMagazineIssueAction,
  setLatestMagazineIssueAction,
  setFeaturedFlipbookIssueAction,
  getEditionsListingAction,
  getGhostPostsAction,
  type UnifiedEditionRow,
} from './magazine/edition-actions';
import {
  getMagazinePagesAction,
  updateMagazinePageAction,
  addMagazinePageAction,
  deleteMagazinePageAction,
} from './magazine/page-actions';
import {
  getMagazineStoryLibraryAction,
  saveMagazineStoryLibraryAction,
} from './magazine/story-library-actions';
import {
  syncBuilderToReaderEditionAction,
  deleteReaderEditionAction,
  getReaderEditionByIssueIdAction,
  syncReaderEditionToLegacyIssue,
  runSyncLegacyFromReaderEditionAction,
} from './magazine/reader-edition-actions';
import { fetchIssuuMetadataAction } from './magazine/issuu-actions';
import {
  importIdmlAction,
  importIdmlFromStoragePathForPublishAction,
  importIdmlFromUrlAction,
  extractIdmlStoryLibraryAction,
  importIdmlToStoryLibraryAction,
  importIdmlToStoryLibraryFromUrlAction,
  importIdmlToStoryLibraryFromStoragePathAction,
  publishIdmlEditionAction,
  uploadIdmlFileToStorageAction,
  saveIdmlDraft,
  loadIdmlDraft,
  loadLatestIdmlDraft,
  deleteIdmlDraft,
} from './magazine/idml-import-actions';

export {
  getMagazineIssuesAction,
  updateMagazineIssueAction,
  createMagazineIssueAction,
  deleteMagazineIssueAction,
  setLatestMagazineIssueAction,
  setFeaturedFlipbookIssueAction,
  getEditionsListingAction,
  getGhostPostsAction,
  type UnifiedEditionRow,
  getMagazinePagesAction,
  updateMagazinePageAction,
  addMagazinePageAction,
  deleteMagazinePageAction,
  getMagazineStoryLibraryAction,
  saveMagazineStoryLibraryAction,
  syncBuilderToReaderEditionAction,
  deleteReaderEditionAction,
  getReaderEditionByIssueIdAction,
  syncReaderEditionToLegacyIssue,
  runSyncLegacyFromReaderEditionAction,
  fetchIssuuMetadataAction,
  importIdmlAction,
  importIdmlFromStoragePathForPublishAction,
  importIdmlFromUrlAction,
  extractIdmlStoryLibraryAction,
  importIdmlToStoryLibraryAction,
  importIdmlToStoryLibraryFromUrlAction,
  importIdmlToStoryLibraryFromStoragePathAction,
  publishIdmlEditionAction,
  uploadIdmlFileToStorageAction,
  saveIdmlDraft,
  loadIdmlDraft,
  loadLatestIdmlDraft,
  deleteIdmlDraft,
};
