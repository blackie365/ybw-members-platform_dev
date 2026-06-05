'use client';

import { useState, useMemo } from 'react';
import { 
  Search, 
  Users, 
  Star, 
  Filter, 
  X,
  ArrowRight,
  Globe,
  Linkedin
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Member {
  id: string;
  name: string;
  company: string;
  role: string;
  bio: string;
  image: string;
  isFeatured?: boolean;
  membershipTier?: string;
  industrySector?: string;
  location?: string;
  website?: string;
  linkedin?: string;
}

const SECTORS = [
  'Accountancy & Finance',
  'Architecture & Design',
  'Consulting',
  'Education & Training',
  'Fashion & Beauty',
  'Healthcare',
  'Hospitality & Tourism',
  'Legal',
  'Marketing & PR',
  'Technology & IT',
  'Professional Services'
];

export function BusinessDirectoryClient({ initialMembers }: { initialMembers: Member[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false);

  const featuredMembers = useMemo(() => {
    return initialMembers.filter(m => m.isFeatured);
  }, [initialMembers]);

  const filteredMembers = useMemo(() => {
    return initialMembers.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           m.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           m.bio.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSector = !selectedSector || m.industrySector === selectedSector;
      const matchesFeatured = !showOnlyFeatured || m.isFeatured;

      return matchesSearch && matchesSector && matchesFeatured;
    });
  }, [initialMembers, searchTerm, selectedSector, showOnlyFeatured]);

  return (
    <div className="space-y-12">
      {/* Search & Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, company, or expertise..." 
              className="pl-10 h-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Button 
              variant={showOnlyFeatured ? "default" : "outline"}
              onClick={() => setShowOnlyFeatured(!showOnlyFeatured)}
              className="h-12 whitespace-nowrap"
            >
              <Star className={`h-4 w-4 mr-2 ${showOnlyFeatured ? 'fill-current' : ''}`} />
              Power-List
            </Button>
            <div className="relative">
              <SelectSector 
                selected={selectedSector} 
                onSelect={setSelectedSector} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Power-List Showcase (Only show if not filtering heavily) */}
      {!searchTerm && !selectedSector && featuredMembers.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-accent fill-accent" />
              <h2 className="font-serif text-2xl font-bold italic tracking-tight">The Power-List</h2>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Featured Members</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredMembers.map((member) => (
              <PowerCard key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}

      {/* Main Directory Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="font-serif text-2xl font-bold tracking-tight">Business Directory</h2>
          <span className="text-sm text-muted-foreground">{filteredMembers.length} Results</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map((member) => (
            <DirectoryCard key={member.id} member={member} />
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed rounded-xl">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No members found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your filters or search terms.</p>
            <Button 
              variant="link" 
              onClick={() => {
                setSearchTerm('');
                setSelectedSector(null);
                setShowOnlyFeatured(false);
              }}
              className="mt-2 text-accent"
            >
              Clear all filters
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function PowerCard({ member }: { member: Member }) {
  return (
    <Card className="group overflow-hidden border-accent/20 bg-accent/5 hover:border-accent/40 transition-all duration-300">
      <CardContent className="p-0">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Image 
            src={member.image || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80'} 
            alt={member.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white translate-y-2 group-hover:translate-y-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Power-List Member</p>
            <h3 className="text-xl font-serif font-bold italic">{member.name}</h3>
            <p className="text-sm text-white/70 line-clamp-1">{member.role} at {member.company}</p>
          </div>
        </div>
        <div className="p-4 flex items-center justify-between bg-white dark:bg-card">
          <Link 
            href={`/members/${member.id}`}
            className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 group-hover:text-accent transition-colors"
          >
            View Profile <ArrowRight className="h-3 w-3" />
          </Link>
          <div className="flex gap-2">
            {member.linkedin && (
              <a href={member.linkedin} target="_blank" className="text-muted-foreground hover:text-accent">
                <Linkedin className="h-4 w-4" />
              </a>
            )}
            {member.website && (
              <a href={member.website} target="_blank" className="text-muted-foreground hover:text-accent">
                <Globe className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DirectoryCard({ member }: { member: Member }) {
  return (
    <Card className="group hover:border-accent/30 transition-all duration-300 shadow-sm hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-muted group-hover:border-accent/20 transition-colors">
            <Image 
              src={member.image || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&q=80'} 
              alt={member.name}
              fill
              className="object-cover"
            />
          </div>
          {member.isFeatured && (
            <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 text-[10px] uppercase font-bold px-1.5 py-0">
              Featured
            </Badge>
          )}
        </div>
        
        <div className="space-y-1">
          <h3 className="font-serif text-lg font-bold tracking-tight">{member.name}</h3>
          <p className="text-sm font-medium text-stone-900 line-clamp-1">{member.company}</p>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{member.industrySector || 'Professional'}</p>
        </div>

        <p className="mt-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {member.bio || 'Connecting and growing with the Yorkshire BusinessWoman network.'}
        </p>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
          <Link 
            href={`/members/${member.id}`}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-accent transition-colors"
          >
            Full Profile
          </Link>
          <div className="flex gap-3">
            {member.linkedin && <Linkedin className="h-3.5 w-3.5 text-muted-foreground hover:text-accent" />}
            {member.website && <Globe className="h-3.5 w-3.5 text-muted-foreground hover:text-accent" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectSector({ selected, onSelect }: { selected: string | null, onSelect: (val: string | null) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 min-w-[160px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-[120px]">{selected || 'All Sectors'}</span>
        </div>
        {selected && (
          <X 
            className="h-3 w-3 hover:text-accent ml-2" 
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }} 
          />
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-xl z-20 py-2">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border mb-1">
              Filter by Sector
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <button 
                onClick={() => { onSelect(null); setIsOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                All Sectors
              </button>
              {SECTORS.map(sector => (
                <button 
                  key={sector}
                  onClick={() => { onSelect(sector); setIsOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${selected === sector ? 'text-accent font-medium' : ''}`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
