define(["dojo/store/Memory"], function(Memory){
	return function(){
		return new Memory({
			data: [
				{
					id: "1",
					Group: "Engineer",
					First: "Anne",
					Last: "Ackerman",
					Location: "NY",
					Office: "1S76",
					Email: "a.a@test.com",
					Tel: "123-764-8237",
					Fax: "123-764-8228"
				},
				{
					id: "2",
					Group: "Engineer",
					First: "Ben",
					Last : "Beckham",
					Location: "NY",
					Office: "5N47",
					Email: "b.b@test.com",
					Tel: "123-764-8599",
					Fax: "123-764-8600"
				},
				{
					id: "3",
					Group: "Engineer",
					First: "Chad",
					Last: "Chapman",
					Location: "CA",
					Office: "1278",
					Email: "c.c@test.com",
					Tel: "408-764-8237",
					Fax: "408-764-8228"
				},
				{
					id: "4",
					Group: "Engineer",
					First: "David",
					Last: "Durham",
					Location: "NJ",
					Office: "C12",
					Email: "d.d@test.com",
					Tel: "514-764-8237",
					Fax: "514-764-8228"
				},
				{
					id: "5",
					Group: "Engineer",
					First: "Emma",
					Last: "Eklof",
					Location: "NY",
					Office: "4N76",
					Email: "e.e@test.com",
					Tel: "123-764-1234",
					Fax: "123-764-4321"
				},
				{
					id: "6",
					Group: "Manager",
					First: "Fred",
					Last: "Fisher",
					Location: "NJ",
					Office: "V89",
					Email: "f.f@test.com",
					Tel: "514-764-8567",
					Fax: "514-764-8000"
				},
				{
					id: "7",
					Group: "Manager",
					First: "George",
					Last: "Garnett",
					Location: "NY",
					Office: "7S11",
					Email: "gig@test.com",
					Tel: "123-999-8599",
					Fax: "123-999-8600"
				},
				{
					id: "8",
					Group: "Accountant",
					First: "Hunter",
					Last: "Huffman",
					Location: "CA",
					Office: "6532",
					Email: "h.h@test.com",
					Tel: "408-874-8237",
					Fax: "408-874-8228"
				},
				{
					id: "9",
					Group: "Accountant",
					First: "Irene",
					Last: "Ira",
					Location: "NJ",
					Office: "F09",
					Email: "i.i@test.com",
					Tel: "514-764-6532",
					Fax: "514-764-7300"
				},
				{
					id: "10",
					Group: "Accountant",
					First: "John",
					Last: "Jacklin",
					Location: "CA",
					Office: "6701",
					Email: "j.j@test.com",
					Tel: "408-764-1234",
					Fax: "408-764-4321"
				}
			]
		});
	}
});