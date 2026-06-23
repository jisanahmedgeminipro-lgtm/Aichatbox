module.exports = async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");


  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }


  try {

    const { messages } = req.body;


    const apiKey = process.env.GEMINI_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        error: "Gemini key missing"
      });

    }


    const response = await fetch(

      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,

      {

        method: "POST",

        headers: {

          "Content-Type": "application/json"

        },


        body: JSON.stringify({

          contents: messages.map(m => ({

            role: m.role === "assistant" ? "model" : "user",

            parts: [
              {
                text: m.content
              }
            ]

          }))


        })


      }

    );


    const data = await response.json();


    console.log(data);


    if (!data.candidates) {

      return res.status(500).json({

        error: data.error?.message || "Gemini response error"

      });

    }



    return res.status(200).json({

      reply: data.candidates[0].content.parts[0].text

    });



  } catch (err) {


    console.error(err);


    return res.status(500).json({

      error: err.message

    });


  }


};