### R Package Dependencies:
Install the required packages by running:
```R
install.packages(c("plumber", "gamlss", "dplyr", "tidyr", "purrr"))
```

### To use the tool

Navigate to this directory, then run the command
```bash
Rscript run_api.R
```

Open another Terminal in the same directory then run
```bash
python -m http.server 8080
```

You have to execute both steps even if you only make changes to the web interface (otherwise the prediction data won't show up).
