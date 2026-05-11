'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { AdminFeatureToggle } from './AdminFeatureToggle';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function AdminControlWrapper({ memberId, isCurrentlyFeatured }: { memberId: string, isCurrentlyFeatured: boolean }) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      try {
        const docRef = doc(db, 'newMemberCollection', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().isAdmin === true) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }

    if (!loading) {
      checkAdminStatus();
    }
  }, [user, loading]);

  if (loading || checking) return null;
  if (!isAdmin) return null;

  return (
    <div className="mt-8">
      <AdminFeatureToggle memberId={memberId} isCurrentlyFeatured={isCurrentlyFeatured} />
    </div>
  );
}