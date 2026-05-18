const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Generate a truly random password
const generateRandomPassword = () => {
  const length = 12;
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = "";
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to randomize character positions
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Generate a random password incorporating email (deprecated - for backward compatibility)
const generatePassword = (email) => {
  return generateRandomPassword();
};

// Generate and hash password
const generateHashedPassword = async (email) => {
  const plainPassword = generateRandomPassword();
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);
  return { plainPassword, hashedPassword };
};

module.exports = { generatePassword, generateHashedPassword, generateRandomPassword };
