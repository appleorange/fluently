export default function LoadingDots({ small }: { small?: boolean }) {
  return (
    <div className={small ? 'lds-ellipsis-sm' : 'lds-ellipsis'} aria-label="Loading">
      <div /><div /><div /><div />
    </div>
  )
}
