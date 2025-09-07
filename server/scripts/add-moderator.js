require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Community = require("../models/community.model");
const kleur = require("kleur");
const bcrypt = require("bcrypt");
const LOG = console.log;

// Setup readline interface for command-line input/output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Connect to MongoDB
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    LOG(kleur.green().bold("✅ Connected to MongoDB"));
    // Start the main application logic after successful connection
    start();
  })
  .catch((err) => {
    LOG(kleur.red().bold("Error connecting to database: " + err.message));
    process.exit(1);
  });

/**
 * Main function to start the script and present user options.
 */
async function start() {
  try {
    const choice = await promptUserChoice(
      kleur.cyan().bold("What would you like to do? (Enter the number)"),
      ["Create a new moderator", "Add an existing moderator to a community"]
    );

    switch (choice) {
      case "1":
        await createModerator();
        break;
      case "2":
        await addModeratorToCommunity();
        break;
      default:
        LOG(kleur.red().bold("Invalid choice."));
        break;
    }

    rl.close();
    process.exit(0);
  } catch (err) {
    LOG(kleur.red().bold("Error: " + err.message));
    rl.close();
    process.exit(1);
  }
}

/**
 * Handles the logic for creating a new moderator.
 */
async function createModerator() {
  LOG(kleur.magenta().bold("\n--- Create New Moderator ---"));
  const name = await promptForInput(kleur.cyan().bold("Enter moderator's name:"));
  const email = await promptForInput(kleur.cyan().bold("Enter moderator's email:"));
  const password = await promptForInput(kleur.cyan().bold("Enter moderator's password:"));

  // Check if a user with this email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    LOG(
      kleur
        .yellow()
        .bold(
          `⚠️ Warning: A user with email ${kleur.white(email)} already exists.`
        )
    );
    return;
  }

  // Hash the password before saving
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create and save the new user with the moderator role
  const newUser = new User({
    name,
    email,
    password: hashedPassword, // Use the hashed password
    role: "moderator",
  });
  await newUser.save();

  LOG(
    kleur
      .green()
      .bold(
        `✅ Success! Moderator ${kleur.white(name)} created successfully.`
      )
  );
}

/**
 * Handles the logic for adding an existing moderator to a community.
 */
async function addModeratorToCommunity() {
  LOG(kleur.magenta().bold("\n--- Add Moderator to Community ---"));
  const moderators = await User.find({ role: "moderator" });

  if (moderators.length === 0) {
    LOG(kleur.yellow().bold("No moderators found in the database."));
    return;
  }

  // Prompt user to select a moderator
  const modChoice = await promptUserChoice(
    kleur.cyan().bold("Which moderator would you like to add? (Enter the number)"),
    moderators.map((mod) => `${mod.name} - ${mod.email}`)
  );

  const moderatorToAdd = moderators[modChoice - 1];
  if (!moderatorToAdd) {
    LOG(kleur.red().bold("Error! Moderator not found."));
    return;
  }

  // Prompt user to select a community
  const communities = await Community.find({}, "name");
  if (communities.length === 0) {
    LOG(kleur.yellow().bold("No communities found."));
    return;
  }
  const communityNames = communities.map((community) => community.name);

  const communityChoice = await promptUserChoice(
    kleur
      .cyan()
      .bold(
        "Which community would you like to add the moderator to? (Enter the number)"
      ),
    communityNames
  );

  const communityName = communityNames[communityChoice - 1];
  const chosenCommunity = await Community.findOne({ name: communityName });

  if (!chosenCommunity) {
    LOG(kleur.yellow().bold(`⚠️ Warning: Community does not exist.`));
    return;
  }

  // Check if the user is already a moderator of the community
  if (chosenCommunity.moderators.includes(moderatorToAdd._id)) {
    LOG(
      kleur
        .yellow()
        .bold(
          `⚠️ Warning: ${kleur.white(
            moderatorToAdd.name
          )} is already a moderator of the ${kleur.white(
            communityName
          )} community!`
        )
    );
    return;
  }

  // Add the moderator to the community's moderators and members lists
  await Community.updateOne(
    { name: communityName },
    {
      $addToSet: {
        moderators: moderatorToAdd._id,
        members: moderatorToAdd._id, // Also add them as a member
      },
    }
  );

  LOG(
    kleur
      .green()
      .bold(
        `✅ Done! ${kleur.white(
          moderatorToAdd.name
        )} has been added as a moderator and member of the ${kleur.white(
          communityName
        )} community.`
      )
  );
}

/**
 * A generic prompt to get freeform text input from the user.
 * @param {string} promptText The question to ask the user.
 * @returns {Promise<string>} The user's answer.
 */
function promptForInput(promptText) {
  return new Promise((resolve) => {
    rl.question(`${promptText} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts the user to select an option from a list of choices.
 * @param {string} prompt The question to display.
 * @param {string[]} choices An array of choices to display to the user.
 * @returns {Promise<string>} The number of the chosen option as a string.
 */
async function promptUserChoice(prompt, choices) {
  return new Promise((resolve, reject) => {
    const choicesString = choices
      .map((choice, index) => `${index + 1}. ${choice}`)
      .join("\n");

    rl.question(`${prompt}\n${choicesString}\n> `, (answer) => {
      const choiceIndex = parseInt(answer, 10);
      if (
        isNaN(choiceIndex) ||
        choiceIndex <= 0 ||
        choiceIndex > choices.length
      ) {
        reject(new Error(kleur.red().bold("Invalid choice")));
      } else {
        // Resolve with the number (e.g., "1", "2")
        resolve(String(choiceIndex));
      }
    });
  });
}

