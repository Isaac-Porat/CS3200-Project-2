// I used ChatGPT to help me format the queries and brainstorm creative ideas

const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = "mongodb://localhost:27017/";

const client = new MongoClient(uri,  {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    }
);

async function run() {
  try {
    await client.connect();

    // Send a ping to confirm a successful connection
    await client.db("db-project-2").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Query 1 - aggregation: calculate the average condition of all shoe listings
    const queryOneResult = await client.db("db-project-2").collection("db").aggregate([
      { $unwind: "$listings" },
      { $group: {_id: null, averageCondition: { $avg: { $toDecimal: "$listings.conditionOfShoe" }}}}
    ]).toArray();

    const averageCondition = queryOneResult[0].averageCondition ? queryOneResult[0].averageCondition.toString() : "N/A";

    console.log(`Average Shoe Condition: ${averageCondition}`)

    // Query 2 - complex search criterion: find listings that are within a specific price range and have a condition above a certain threshold and return the name of the shoe and the link in ascending order
    const queryTwoResult = await client.db("db-project-2").collection("db").aggregate([
      { $unwind: "$listings" },
      {
        $addFields: {
          "listings.priceOfShoeNumeric": { $convert: { input: "$listings.priceOfShoe", to: "double"}},
          "listings.conditionOfShoeNumeric": { $convert: { input: "$listings.conditionOfShoe", to: "int"}},
        }
      },
      {
        $match: {
          $and: [
            {"listings.priceOfShoeNumeric": { $gte: 200, $lte: 500 }},
            {"listings.conditionOfShoeNumeric": { $gte: 85}}
          ]
        }
      },
      {
        $sort: {
          "listings.priceOfShoeNumeric": 1,
        }
      },
      {
        $project: {
          _id: 0,
          "title": "$listings.title",
          "url": "$listings.url",
          "priceOfShoe": "$listings.priceOfShoe",
          "conditionOfShoe": "$listings.conditionOfShoe"
        }
      }
    ]).toArray();
    console.log(`Listings by price and condition: ${JSON.stringify(queryTwoResult, null, 2)})}`)

    // Query 3 - counting documents for a specific user: find the number of documents with listings thatv have Retro High in the title
    const queryThreeResult = await client.db("db-project-2").collection("db").countDocuments({
      "listings.title": { $regex: /Retro High/, $options: 'i' }
    });
    console.log(`Number of documents with listings that have Retro High in the title: `, queryThreeResult)

    // Query 4 - updating a document based on a query parameter: if the listing status is not available, remove the listing from potential inventory
    const listings = await client.db("db-project-2").collection("db").find({}, { listings: 1 }).toArray();
    let unavailableListingIds = [];

    listings.forEach(doc => {
      if (Array.isArray(doc.listings)) {
        doc.listings.forEach(listing => {
          if (listing.listingStatus && listing.listingStatus.status !== 'available') {
            unavailableListingIds.push(listing.listingId);
          }
        });
      }
    });
    console.log(`Unavailable Listing IDs: ${unavailableListingIds}`);

    const matchedUnavailableListings = listings.filter(doc =>
      doc.potentialInventory.some(inventory =>
        unavailableListingIds.includes(inventory.listingId)
      )
    ).map(doc => doc.potentialInventory.filter(inventory =>
      unavailableListingIds.includes(inventory.listingId)
    ).map(inventory => inventory.listingId));

    console.log(`Matched Unavailable Listing IDs in Potential Inventory: ${JSON.stringify(matchedUnavailableListings)}`);

    await client.db("db-project-2").collection("db").updateMany({}, {
      $pull: {
        potentialInventory: {
          listingId: { $in: unavailableListingIds }
        },
        listings: {
          listingId: { $in: unavailableListingIds }
        }
      }
    });
    console.log(`Removed unavailable listings from both potential inventory and listings.`);

    // Query 5: Showing the data structure of the database
    const queryFiveResult = await client.db("db-project-2").collection("db").find({}).toArray();
    console.log(queryFiveResult)

  } finally {
    await client.close();
  }
}
run().catch(console.dir);

