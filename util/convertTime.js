export function convertTime(query) {
  const data = query.map(entry => {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = currentTime - entry.timestamp;

    if (timeDifference < 60) {
      entry.timestamp = `${timeDifference} second${timeDifference !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 3600) {
      const minutes = Math.floor(timeDifference / 60);
      const secondsRemainder = timeDifference % 60;
      entry.timestamp = `${minutes} minute${minutes !== 1 ? 's' : ''} ${secondsRemainder} second${secondsRemainder !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 86400) {
      const hours = Math.floor(timeDifference / 3600);
      const minutesRemainder = Math.floor((timeDifference % 3600) / 60);
      entry.timestamp = `${hours} hour${hours !== 1 ? 's' : ''} ${minutesRemainder} minute${minutesRemainder !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 2592000) {
      const days = Math.floor(timeDifference / 86400);
      const hoursRemainder = Math.floor((timeDifference % 86400) / 3600);
      entry.timestamp = `${days} day${days !== 1 ? 's' : ''} ${hoursRemainder} hour${hoursRemainder !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 31536000) {
      const months = Math.floor(timeDifference / 2592000);
      const daysRemainder = Math.floor((timeDifference % 2592000) / 86400);
      entry.timestamp = `${months} month${months !== 1 ? 's' : ''} ${daysRemainder} day${daysRemainder !== 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(timeDifference / 31536000);
      const monthsRemainder = Math.floor((timeDifference % 31536000) / 2592000);
      entry.timestamp = `${years} year${years !== 1 ? 's' : ''} ${monthsRemainder} month${monthsRemainder !== 1 ? 's' : ''} ago`;
    }

    return entry;
  })

  return data;
}