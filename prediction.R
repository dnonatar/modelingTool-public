library(dplyr)
library(tidyr)
library(purrr)
library(gamlss)

generate_output <- function(mu_spec, sigma_spec = "~1", distribution = "NO()", dataset) {
  n_draws <- 5
  data = dataset
  outcome_name <- sym(sub("\\~.*", "", gsub(" ", "", mu_spec, fixed = TRUE)))
  model_name <- sym(paste(distribution, mu_spec, sigma_spec, sep = "| "))
  
  # fit model
  mu_spec <- as.formula(mu_spec)
  sigma_spec <- as.formula(sigma_spec)
  distribution_function <- eval(parse(text = distribution))

  #model <- gamlss(mu_spec, sigma.formula = sigma_spec, family = distribution_function, data = data)
  model <- gamlss(
    mu_spec, 
    sigma.formula = sigma_spec, 
    #family = NO(), 
    family = distribution_function,
    data = data
  )
  
  ## residuals 
  df_res <- data.frame(
    residual_mu = resid(model, what = "mu"),
    fitted = fitted(model)
  )
  
  
  #model <- eval(bquote(gamlss(.(mu_spec), sigma.formula = .(sigma_spec), family = .(distribution_function), data = data)))
  rsq <- Rsq(model, type="Cragg Uhler")
  
  # Find the line containing "Global Deviance"
  model_summary <- capture.output(summary(model))
  aic_line <- grep("AIC", model_summary, value = TRUE)
  aic_val <- as.numeric(gsub(".*AIC:\\s*", "", aic_line))
  #deviance_line <- grep("Global Deviance", model_summary, value = TRUE)
  #global_deviance <- as.numeric(gsub(".*Global Deviance:\\s*", "", deviance_line))
  
  # get summary statistics describing model predictions
  pred.mu <- predict(model, se.fit = TRUE, type = "response")
  pred.sigma <- predict(model, what = "sigma", se.fit = TRUE)
  output <- data %>%
    mutate(
      mu.expectation = pred.mu$fit,                       # add fitted mu and its standard error to dataframe
      mu.se = pred.mu$se.fit,
      logsigma.expectation = pred.sigma$fit,              # add fitted logsigma and its standard error to dataframe 
      logsigma.se = pred.sigma$se.fit,
      df = df.residual(model)                             # get degrees of freedom
    )
  
  # propagate uncertainty in fit to generate an ensemble of model predictions (mimic a posterior predictive distribution)
  output <- output %>%
    mutate(
      draw = list(1:n_draws),                             # generate list of draw numbers
      t1 = map(df, ~rt(n_draws, .)),                      # simulate draws from t distribution to transform into means
      t2 = map(df, ~rt(n_draws, .))                       # simulate draws from t distribution to transform into log sigma
    ) %>%
    unnest(cols = c("draw", "t1", "t2")) %>%
    mutate(
      mu = t1 * mu.se + mu.expectation,                   # scale and shift t to get a sampling distribution of means
      logsigma = t2 * logsigma.se + logsigma.expectation, # scale and shift t to get a sampling distribution of log sigma
      sigma = exp(logsigma)                               # backtransform to sampling distribution of sigma parameter
    ) %>%
    rowwise() %>%
    mutate(
      # compute predictive distribution
      prediction = rnorm(1, mu, sigma)
    ) %>%
    rename(
      data = !!outcome_name,
      !!model_name := prediction
    ) %>%
    pivot_longer(
      cols = c("data", model_name),
      names_to = "modelcheck_group",
      values_to = as.character(outcome_name)
    ) %>%
    dplyr::select(-one_of("mu.expectation", "mu.se", "logsigma.expectation", "logsigma.se", "df", "t1", "t2", "mu", "logsigma", "sigma"))

  
  # ### get fit line for the original data
  # 
  # # Extract variable names and term labels
  # term_labels <- attr(terms(mu_spec), "term.labels")
  # all_vars <- all.vars(mu_spec)[-1]
  # 
  # # Identify variable types
  # var_types <- sapply(data[all_vars], function(x) {
  #   if (is.factor(x) || is.character(x)) {
  #     "categorical"
  #   } else if (is.numeric(x)) {
  #     "continuous"
  #   } else {
  #     class(x)
  #   }
  # })
  # 
  # # Store each prediction dataframe
  # prediction_dfs <- list()
  # 
  # # Loop through each continuous variable
  # for (xVar in names(var_types[var_types == "continuous"])) {
  #   
  #   # Robust match for any interaction term involving xVar
  #   interactions <- grep(paste0("(^|:)", xVar, "(:|$)"), term_labels, value = TRUE)
  #   
  #   # Find if there's a categorical partner
  #   groupVar <- NULL
  #   for (int_term in interactions) {
  #     parts <- unlist(strsplit(int_term, ":"))
  #     partner <- setdiff(parts, xVar)
  #     if (length(partner) == 1 && var_types[partner] == "categorical") {
  #       groupVar <- partner
  #       break
  #     }
  #   }
  #   
  #   # Construct new_data
  #   if (!is.null(groupVar)) {
  #     new_data <- setNames(
  #       expand.grid(
  #         seq(min(data[[xVar]], na.rm = TRUE),
  #             max(data[[xVar]], na.rm = TRUE),
  #             length.out = 100),
  #         unique(data[[groupVar]])
  #       ),
  #       c(xVar, groupVar)
  #     )
  #   } else {
  #     new_data <- data.frame(seq(min(data[[xVar]], na.rm = TRUE),
  #                                max(data[[xVar]], na.rm = TRUE),
  #                                length.out = 100))
  #     names(new_data) <- xVar
  #   }
  #   
  #   # Predict and store
  #   print(head(new_data))
  #   print("predicting line fit")
  #   new_data$fit <- predict(model, newdata = new_data, data = data, type = "response", se.fit = FALSE)
  #   
  #   # Add metadata
  #   new_data$variable <- xVar
  #   if (is.null(groupVar)) {
  #     new_data$group <- NA
  #   } else {
  #     names(new_data)[names(new_data) == groupVar] <- "group"
  #   }
  #   
  #   # Append to list
  #   prediction_dfs[[xVar]] <- new_data
  # }
  # 
  # # Combine all individual prediction dataframes
  # final_df <- do.call(rbind, prediction_dfs)
  # rownames(final_df) <- NULL
  
  
  #return(list(df = output[output$modelcheck_group == model_name,], gd = global_deviance))
  #return(list(df = output[output$modelcheck_group == model_name,], aic = aic_val, rsq = rsq, linefit_data = final_df))
  return(list(df = output[output$modelcheck_group == model_name,], aic = aic_val, rsq = rsq, df_res = df_res))
  
}

