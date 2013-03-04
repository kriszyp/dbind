define([
	"../bind",
	"dojo/request/xhr",
	"dojo/Stateful"
], function(bind, dxhr, Stateful){
	var viewModel = bind({
		Name: "John Doe",
		Street: "",
		City: "",
		County: "",
		State: "",
		Zip: "",
		Country: "US",
		BaseIncome: 50000,
		BonusIncome: 10000,
		Mortgage: 1000,
		Taxes: 500,
		OtherHousing: 1200,
		isZipValid: true
	});

	viewModel.set("ZipError", bind(function(valid){
		return !valid ? "Invalid Zip Code." : "";
	}).to(viewModel, "isZipValid"));

	viewModel.set("TotalHousing", bind(function(mortgage, taxes, otherHousing){
		return mortgage + taxes + otherHousing;
	}).to([bind(viewModel, "Mortgage"), bind(viewModel, "Taxes"), bind(viewModel, "OtherHousing")]));

	viewModel.set("TotalIncome", bind(function(baseIncome, bonusIncome){
		return baseIncome + bonusIncome;
	}).to([bind(viewModel, "BaseIncome"), bind(viewModel, "BonusIncome")]));

	viewModel.set("HousingPercent", bind(function(totalHousing, totalIncome){
		return Math.round(totalHousing / totalIncome * 100);
	}).to([bind(viewModel, "TotalHousing"), bind(viewModel, "TotalIncome")]));

	viewModel.set("shouldTotalHousingBeDisabled", bind(function(total){
		return total <= 0;
	}).to(viewModel, "TotalHousing"));

	viewModel.set("HousingPercentError", bind(function(percent){
		return percent > 33 ? "Housing should be less than 1/3 total expenses!" : "";
	}).to(viewModel, "HousingPercent"));

	viewModel.set("HousingPercentDisabled", bind(function(percent){
		return percent <= 0 ? "disabled" : null;
	}).to(viewModel, "HousingPercent"));

	var chartData = viewModel.ChartData = new Stateful();
	bind(viewModel, "Mortgage").then(function(mortgage){
		chartData.set("Mortgage", mortgage);
	});
	bind(viewModel, "Taxes").then(function(taxes){
		chartData.set("Taxes", taxes);
	});
	bind(viewModel, "OtherHousing").then(function(otherHousing){
		chartData.set("OtherHousing", otherHousing);
	});

	function lookup(){
		viewModel.get("Zip", function(zip){
			if(zip && !isNaN(zip)){
				viewModel.get("Country", function(country){
					dxhr.get(require.toUrl("dojox/mvc/tests/zips/" + zip + ".json"), {
						content: {postalcode: zip, country: country},
						preventCache: true,
						handleAs: "json"
					}).then(function(data){
						viewModel.get("City").is(data.postalcodes[0].placeName);
						viewModel.get("County").is(data.postalcodes[0].adminName2);
						viewModel.get("State").is(data.postalcodes[0].adminCode1);
						viewModel.get("isZipValid").is(true);
					}, function(){
						viewModel.get("City").is("");
						viewModel.get("County").is("");
						viewModel.get("State").is("");
						viewModel.get("isZipValid").is(false);
					});
				});
			}
		});
	}

	var lookupProps = {
		Zip: 1,
		Country: 1
	};

	for(var s in lookupProps){
		viewModel.get(s, lookup);
	}

	return viewModel;
});
