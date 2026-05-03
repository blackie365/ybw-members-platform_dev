export const API_BASE = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE || 'https://us-central1-ghostpublishing-v2.cloudfunctions.net';

export const ENDPOINTS = {
  // Member Profile
  getMembers: 'https://getmembersv2-t5742t5rdq-uc.a.run.app',
  getByEmail: 'https://getmemberbyemail-t5742t5rdq-uc.a.run.app',
  updateProfile: 'https://updatememberprofile-t5742t5rdq-uc.a.run.app',
  uploadImage: 'https://uploadmemberimage-t5742t5rdq-uc.a.run.app',
  getLocations: 'https://getlocations-t5742t5rdq-uc.a.run.app/locations',

  // Community & Posts
  getPosts: `${API_BASE}/getMemberPosts`,
  createPost: `${API_BASE}/createMemberPost`,
  updatePost: `${API_BASE}/updateMemberPost`,
  deletePost: `${API_BASE}/deleteMemberPost`,

  // Auth / Ghost
  createGhostSession: `${API_BASE}/createGhostSession`,
  sendPin: `${API_BASE}/sendMemberPin`,
  verifyPin: `${API_BASE}/verifyMemberPin`,
};
