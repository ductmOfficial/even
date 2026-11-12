import { EmptyState, linkButtonClass } from "@even/ui";
import { Link } from "@tanstack/react-router";

export function NotFoundPage() {
  return (
    <EmptyState
      title="Không tìm thấy trang"
      action={
        <Link to="/" className={linkButtonClass()}>
          Về Tổng quan
        </Link>
      }
    />
  );
}
