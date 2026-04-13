import { getFileTypeInfo } from '@/lib/fileTypes';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DateFilter } from '@/hooks/useDocumentBrowse';
import type { SortBy } from '@/hooks/useDocumentBrowse';
import type { Tag } from '@/hooks/useTags';

type Props = {
  dateFilter: DateFilter;
  onDateFilterChange: (value: DateFilter) => void;
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
  fileTypeFilter: string;
  onFileTypeFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  availableFileTypes: string[];
  tags: Tag[];
  totalResults: number;
  totalBaseResults: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onResetFilters: () => void;
  lockTagFilter?: boolean;
};

const dateOptions: { value: DateFilter; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'created_desc', label: 'Upload date: newest to oldest' },
  { value: 'created_asc', label: 'Upload date: oldest to newest' },
  { value: 'updated_desc', label: 'Modified date: newest to oldest' },
  { value: 'updated_asc', label: 'Modified date: oldest to newest' },
];

export default function DocumentBrowseToolbar({
  dateFilter,
  onDateFilterChange,
  sortBy,
  onSortByChange,
  fileTypeFilter,
  onFileTypeFilterChange,
  tagFilter,
  onTagFilterChange,
  availableFileTypes,
  tags,
  totalResults,
  totalBaseResults,
  page,
  totalPages,
  onPageChange,
  onResetFilters,
  lockTagFilter,
}: Props) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 2),
    Math.min(totalPages, page + 1)
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:max-w-5xl w-full">
            <Select value={dateFilter} onValueChange={(value) => onDateFilterChange(value as DateFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortBy)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fileTypeFilter} onValueChange={onFileTypeFilterChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="File type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All file types</SelectItem>
                {availableFileTypes.map((type) => (
                  <SelectItem key={type} value={type}>{getFileTypeInfo(type).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tagFilter} onValueChange={onTagFilterChange} disabled={lockTagFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tag / Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{totalResults}</span> of {totalBaseResults}
            </p>
            <Button variant="ghost" size="sm" onClick={onResetFilters}>Clear filters</Button>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(Math.max(1, page - 1));
                }}
                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {pages.map((pageNum) => (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  href="#"
                  isActive={pageNum === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(pageNum);
                  }}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(Math.min(totalPages, page + 1));
                }}
                className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
