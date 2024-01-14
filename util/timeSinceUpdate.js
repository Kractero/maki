export const minutes = (comparator) => {
  const curr = Math.floor(Date.now() / 1000);
  const elapse = Math.floor((curr - parseInt(comparator)) / 60);
  let minutes = "Just now";
  if (elapse === 1) minutes = "1 minute ago";
  if (elapse > 1) minutes = `${elapse} minutes ago`;
  return minutes;
};
